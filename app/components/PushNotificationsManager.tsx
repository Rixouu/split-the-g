import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { useI18n } from "~/i18n/context";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushNotificationsManager() {
  const { lang } = useI18n();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pushPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? "";

  const syncStatus = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    const registration = await navigator.serviceWorker.ready;
    const current = await registration.pushManager.getSubscription();
    setEnabled(Boolean(current));
  }, []);

  useEffect(() => {
    void syncStatus();
  }, [syncStatus]);

  const sendSubscription = useCallback(
    async (method: "POST" | "DELETE", body: Record<string, unknown>) => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatusMessage("Please sign in again before enabling notifications.");
        return;
      }
      const response = await fetch("/api/push-subscriptions", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(result?.error ?? "Subscription API request failed.");
      }
    },
    [],
  );

  const enablePush = useCallback(async () => {
    if (!pushPublicKey || busy) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(pushPublicKey) as BufferSource,
      });
      await sendSubscription("POST", { ...subscription.toJSON(), locale: lang });
      setEnabled(true);
      setStatusMessage("Notifications enabled on this device.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not enable push notifications.");
    } finally {
      setBusy(false);
    }
  }, [busy, lang, pushPublicKey, sendSubscription]);

  const disablePush = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setEnabled(false);
        return;
      }
      await sendSubscription("DELETE", { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setEnabled(false);
      setStatusMessage("Notifications disabled for this device.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }, [busy, sendSubscription]);

  const canRenderToggle = supported && Boolean(pushPublicKey);

  return (
    <div className="mt-4 rounded-xl border border-guinness-gold/20 bg-guinness-black/30 p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.06)] md:mt-0 md:flex md:flex-row md:items-stretch md:gap-6 md:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-guinness-gold">Push notifications</p>
        <p className="mt-1 text-xs text-guinness-tan/70">
          Get alerts for friend requests, competition invites, friend pours, and top 10 changes.
        </p>
        {!supported ? (
          <p className="mt-2 text-xs text-amber-300/90">
            This browser does not support Web Push in the current context.
          </p>
        ) : null}
        {!pushPublicKey ? (
          <p className="mt-2 text-xs text-amber-300/90">
            Missing VITE_WEB_PUSH_PUBLIC_KEY at runtime. Restart dev server after updating env.
          </p>
        ) : null}
        {permission === "denied" ? (
          <p className="mt-2 text-xs text-amber-300/90">
            Notifications are blocked in your browser settings.
          </p>
        ) : null}
        {statusMessage ? (
          <p className="mt-2 text-xs text-guinness-tan/85">{statusMessage}</p>
        ) : null}
      </div>
      <div className="mt-3 flex shrink-0 md:mt-0 md:w-52 md:flex-col md:justify-center">
        <button
          type="button"
          onClick={() => void (enabled ? disablePush() : enablePush())}
          disabled={!canRenderToggle || busy || permission === "denied"}
          className="w-full rounded-lg border border-guinness-gold/35 bg-guinness-black/50 py-2.5 text-sm font-semibold text-guinness-gold transition-colors hover:bg-guinness-brown/45 disabled:opacity-50 md:py-3"
        >
          {busy ? "Updating..." : enabled ? "Disable notifications" : "Enable notifications"}
        </button>
      </div>
    </div>
  );
}
