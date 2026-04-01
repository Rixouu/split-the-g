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
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
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
        setDebugMessage("Please sign in again before enabling notifications.");
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
    setDebugMessage(null);
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
      setDebugMessage("Notifications enabled on this device.");
    } catch (error) {
      setDebugMessage(error instanceof Error ? error.message : "Could not enable push notifications.");
    } finally {
      setBusy(false);
    }
  }, [busy, lang, pushPublicKey, sendSubscription]);

  const disablePush = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setDebugMessage(null);
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
      setDebugMessage("Notifications disabled for this device.");
    } catch (error) {
      setDebugMessage(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }, [busy, sendSubscription]);

  const canRenderToggle = supported && Boolean(pushPublicKey);

  const sendTestNotification = useCallback(async () => {
    setDebugMessage(null);
    try {
      const supabase = await getSupabaseBrowserClient();
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);
      const token = sessionData.session?.access_token;
      const email = userData.user?.email?.trim().toLowerCase();
      if (!token || !email) {
        setDebugMessage("Missing session/email. Sign out and back in, then try again.");
        return;
      }

      const response = await fetch("/api/push-notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "friend_request_received",
          toEmail: email,
          actorName: "Split the G",
          path: "/profile/account",
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            success?: boolean;
            report?: {
              totalSubscriptions?: number;
              sent?: number;
              failed?: number;
              errors?: string[];
              configured?: boolean;
            };
          }
        | null;
      if (!response.ok) {
        setDebugMessage(result?.error ?? "Push test failed.");
        return;
      }
      const report = result?.report;
      if (!report) {
        setDebugMessage("Push test request completed but no delivery report was returned.");
        return;
      }
      setDebugMessage(
        `Push report: configured=${String(Boolean(report.configured))}, subscriptions=${report.totalSubscriptions ?? 0}, sent=${report.sent ?? 0}, failed=${report.failed ?? 0}${report.errors?.[0] ? `, firstError=${report.errors[0]}` : ""}`,
      );
    } catch (error) {
      setDebugMessage(error instanceof Error ? error.message : "Push test failed.");
    }
  }, []);

  return (
    <div className="mt-4 rounded-lg border border-guinness-gold/20 bg-guinness-black/30 p-4">
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
      <button
        type="button"
        onClick={() => void (enabled ? disablePush() : enablePush())}
        disabled={!canRenderToggle || busy || permission === "denied"}
        className="mt-3 w-full rounded-lg border border-guinness-gold/35 bg-guinness-black/50 py-2 text-sm font-semibold text-guinness-gold transition-colors hover:bg-guinness-brown/45 disabled:opacity-50"
      >
        {busy ? "Updating..." : enabled ? "Disable notifications" : "Enable notifications"}
      </button>
      <button
        type="button"
        onClick={() => void sendTestNotification()}
        disabled={!canRenderToggle || !enabled || busy}
        className="mt-2 w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/40 py-2 text-xs font-semibold text-guinness-tan transition-colors hover:bg-guinness-brown/40 disabled:opacity-40"
      >
        Send test notification
      </button>
      {permission === "denied" ? (
        <p className="mt-2 text-xs text-amber-300/90">
          Notifications are blocked in your browser settings.
        </p>
      ) : null}
      {debugMessage ? (
        <p className="mt-2 text-xs text-guinness-tan/85">{debugMessage}</p>
      ) : null}
    </div>
  );
}
