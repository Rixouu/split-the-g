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

  const pushPublicKey =
    typeof window === "undefined"
      ? ""
      : ((window as Window & { ENV?: { WEB_PUSH_PUBLIC_KEY?: string } }).ENV
          ?.WEB_PUSH_PUBLIC_KEY ?? "");

  const syncStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
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
      if (!token) return;
      await fetch("/api/push-subscriptions", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    },
    [],
  );

  const enablePush = useCallback(async () => {
    if (!pushPublicKey || busy) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(pushPublicKey),
      });
      await sendSubscription("POST", { ...subscription.toJSON(), locale: lang });
      setEnabled(true);
    } finally {
      setBusy(false);
    }
  }, [busy, lang, pushPublicKey, sendSubscription]);

  const disablePush = useCallback(async () => {
    if (busy) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }, [busy, sendSubscription]);

  if (!supported || !pushPublicKey) return null;

  return (
    <div className="mt-4 rounded-lg border border-guinness-gold/20 bg-guinness-black/30 p-4">
      <p className="text-sm font-semibold text-guinness-gold">Push notifications</p>
      <p className="mt-1 text-xs text-guinness-tan/70">
        Get alerts for friend requests, competition invites, friend pours, and top 10 changes.
      </p>
      <button
        type="button"
        onClick={() => void (enabled ? disablePush() : enablePush())}
        disabled={busy || permission === "denied"}
        className="mt-3 w-full rounded-lg border border-guinness-gold/35 bg-guinness-black/50 py-2 text-sm font-semibold text-guinness-gold transition-colors hover:bg-guinness-brown/45 disabled:opacity-50"
      >
        {busy ? "Updating..." : enabled ? "Disable notifications" : "Enable notifications"}
      </button>
      {permission === "denied" ? (
        <p className="mt-2 text-xs text-amber-300/90">
          Notifications are blocked in your browser settings.
        </p>
      ) : null}
    </div>
  );
}
