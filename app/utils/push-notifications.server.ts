import webpush from "web-push";
import type { SupportedLocale } from "~/i18n/config";
import { createClient } from "@supabase/supabase-js";

interface PushPayloadOptions {
  type:
    | "friend_request_received"
    | "competition_invite_received"
    | "friend_split_the_g"
    | "leaderboard_knocked_out_top10";
  locale?: string | null;
  actorName?: string | null;
  competitionTitle?: string | null;
  score?: number | null;
  path?: string | null;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSendReport {
  configured: boolean;
  totalSubscriptions: number;
  sent: number;
  failed: number;
  errors: string[];
}

const DEFAULT_ICON = "/web-app-manifest-192x192.png";
const DEFAULT_BADGE = "/favicon-96x96.png";

const MESSAGES: Record<
  PushPayloadOptions["type"],
  Record<SupportedLocale, (options: PushPayloadOptions) => { title: string; body: string }>
> = {
  friend_request_received: {
    en: (o) => ({
      title: "New friend request",
      body: `${o.actorName ?? "Someone"} sent you a friend request.`,
    }),
    th: (o) => ({
      title: "มีคำขอเป็นเพื่อนใหม่",
      body: `${o.actorName ?? "มีคน"} ส่งคำขอเป็นเพื่อนถึงคุณ`,
    }),
    fr: (o) => ({
      title: "Nouvelle demande d'ami",
      body: `${o.actorName ?? "Quelqu'un"} vous a envoyé une demande d'ami.`,
    }),
    es: (o) => ({
      title: "Nueva solicitud de amistad",
      body: `${o.actorName ?? "Alguien"} te envió una solicitud de amistad.`,
    }),
    de: (o) => ({
      title: "Neue Freundschaftsanfrage",
      body: `${o.actorName ?? "Jemand"} hat dir eine Freundschaftsanfrage gesendet.`,
    }),
    it: (o) => ({
      title: "Nuova richiesta di amicizia",
      body: `${o.actorName ?? "Qualcuno"} ti ha inviato una richiesta di amicizia.`,
    }),
    ja: (o) => ({
      title: "新しいフレンド申請",
      body: `${o.actorName ?? "誰か"} からフレンド申請が届きました。`,
    }),
  },
  competition_invite_received: {
    en: (o) => ({
      title: "Competition invite",
      body: `${o.actorName ?? "Someone"} invited you to ${o.competitionTitle ?? "a competition"}.`,
    }),
    th: (o) => ({
      title: "คำเชิญเข้าร่วมการแข่งขัน",
      body: `${o.actorName ?? "มีคน"} ชวนคุณเข้าร่วม ${o.competitionTitle ?? "การแข่งขัน"}`,
    }),
    fr: (o) => ({
      title: "Invitation à une compétition",
      body: `${o.actorName ?? "Quelqu'un"} vous a invité à ${o.competitionTitle ?? "une compétition"}.`,
    }),
    es: (o) => ({
      title: "Invitación a competición",
      body: `${o.actorName ?? "Alguien"} te invitó a ${o.competitionTitle ?? "una competición"}.`,
    }),
    de: (o) => ({
      title: "Wettbewerbseinladung",
      body: `${o.actorName ?? "Jemand"} hat dich zu ${o.competitionTitle ?? "einem Wettbewerb"} eingeladen.`,
    }),
    it: (o) => ({
      title: "Invito alla competizione",
      body: `${o.actorName ?? "Qualcuno"} ti ha invitato a ${o.competitionTitle ?? "una competizione"}.`,
    }),
    ja: (o) => ({
      title: "大会への招待",
      body: `${o.actorName ?? "誰か"} が ${o.competitionTitle ?? "大会"} に招待しました。`,
    }),
  },
  friend_split_the_g: {
    en: (o) => ({
      title: "Your friend split the G",
      body: `${o.actorName ?? "A friend"} just scored ${Number(o.score ?? 0).toFixed(2)}.`,
    }),
    th: (o) => ({
      title: "เพื่อนของคุณ Split the G แล้ว",
      body: `${o.actorName ?? "เพื่อนคนหนึ่ง"} เพิ่งได้คะแนน ${Number(o.score ?? 0).toFixed(2)}.`,
    }),
    fr: (o) => ({
      title: "Ton ami a split le G",
      body: `${o.actorName ?? "Un ami"} vient de faire ${Number(o.score ?? 0).toFixed(2)}.`,
    }),
    es: (o) => ({
      title: "Tu amigo hizo Split the G",
      body: `${o.actorName ?? "Un amigo"} acaba de marcar ${Number(o.score ?? 0).toFixed(2)}.`,
    }),
    de: (o) => ({
      title: "Dein Freund hat das G gesplittet",
      body: `${o.actorName ?? "Ein Freund"} hat gerade ${Number(o.score ?? 0).toFixed(2)} erzielt.`,
    }),
    it: (o) => ({
      title: "Un tuo amico ha split-tato la G",
      body: `${o.actorName ?? "Un amico"} ha appena segnato ${Number(o.score ?? 0).toFixed(2)}.`,
    }),
    ja: (o) => ({
      title: "フレンドが Split the G しました",
      body: `${o.actorName ?? "フレンド"} が ${Number(o.score ?? 0).toFixed(2)} を記録しました。`,
    }),
  },
  leaderboard_knocked_out_top10: {
    en: () => ({
      title: "Top 10 update",
      body: "You were knocked out of the global top 10 leaderboard. Time for another pour.",
    }),
    th: () => ({
      title: "อัปเดต Top 10",
      body: "คุณหลุดจากอันดับ Top 10 แล้ว ได้เวลารินใหม่!",
    }),
    fr: () => ({
      title: "Mise à jour Top 10",
      body: "Tu as quitté le top 10 global. Il est temps de refaire un pour.",
    }),
    es: () => ({
      title: "Actualización Top 10",
      body: "Saliste del top 10 global. Hora de hacer otro pour.",
    }),
    de: () => ({
      title: "Top-10-Update",
      body: "Du bist aus den globalen Top 10 gefallen. Zeit für einen neuen Pour.",
    }),
    it: () => ({
      title: "Aggiornamento Top 10",
      body: "Sei uscito dalla top 10 globale. È ora di fare un altro pour.",
    }),
    ja: () => ({
      title: "トップ10更新",
      body: "グローバルのトップ10から外れました。もう一度チャレンジしましょう。",
    }),
  },
};

function getServiceRoleClient() {
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function ensureWebPushConfigured() {
  const subject = process.env.WEB_PUSH_SUBJECT;
  const publicKey = process.env.VITE_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function localeOrDefault(locale: string | null | undefined): SupportedLocale {
  const normalized = (locale ?? "").trim().toLowerCase() as SupportedLocale;
  return normalized in MESSAGES.friend_request_received ? normalized : "en";
}

async function sendToSubscriptions(
  rows: PushSubscriptionRow[],
  options: PushPayloadOptions,
): Promise<PushSendReport> {
  const configured = ensureWebPushConfigured();
  if (rows.length === 0 || !configured) {
    return {
      configured,
      totalSubscriptions: rows.length,
      sent: 0,
      failed: 0,
      errors: configured ? [] : ["Web Push is not configured on the server."],
    };
  }
  const locale = localeOrDefault(options.locale);
  const template = MESSAGES[options.type][locale](options);
  const payload = JSON.stringify({
    title: template.title,
    body: template.body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    path: options.path ?? "/",
  });
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? String((error as { statusCode?: number }).statusCode ?? "")
            : "";
        const body =
          typeof error === "object" && error && "body" in error
            ? String((error as { body?: string }).body ?? "")
            : "";
        errors.push(
          `endpoint=${row.endpoint.slice(0, 48)}... status=${statusCode || "unknown"} body=${body || "n/a"}`,
        );
      }
    }),
  );
  return {
    configured,
    totalSubscriptions: rows.length,
    sent,
    failed,
    errors,
  };
}

export async function sendPushByUserEmail(
  userEmail: string,
  options: PushPayloadOptions,
): Promise<PushSendReport> {
  const supabase = getServiceRoleClient();
  if (!supabase) {
    return {
      configured: false,
      totalSubscriptions: 0,
      sent: 0,
      failed: 0,
      errors: ["Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server."],
    };
  }
  const emailNorm = userEmail.trim().toLowerCase();
  if (!emailNorm) {
    return {
      configured: true,
      totalSubscriptions: 0,
      sent: 0,
      failed: 0,
      errors: ["Missing recipient email."],
    };
  }

  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_email", emailNorm)
    .eq("is_active", true);

  return await sendToSubscriptions((data ?? []) as PushSubscriptionRow[], options);
}

export async function sendFriendSplitNotifications(input: {
  actorUserId: string;
  actorName: string | null;
  score: number;
  path: string;
}) {
  const supabase = getServiceRoleClient();
  if (!supabase) return;

  const { data: friendRows } = await supabase
    .from("user_friends")
    .select("peer_email")
    .eq("user_id", input.actorUserId);

  const targets = [...new Set((friendRows ?? []).map((r) => String(r.peer_email ?? "").trim().toLowerCase()).filter(Boolean))];
  await Promise.all(
    targets.map((email) =>
      sendPushByUserEmail(email, {
        type: "friend_split_the_g",
        actorName: input.actorName,
        score: input.score,
        path: input.path,
      }),
    ),
  );
}

export async function sendKnockedOutTop10NotificationForNewScore(input: {
  newScoreId: string;
  scorePath: string;
}) {
  const supabase = getServiceRoleClient();
  if (!supabase) return;

  const { data: topRows } = await supabase
    .from("scores")
    .select("id,email")
    .order("split_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(11);

  const rows = (topRows ?? []) as Array<{ id: string; email: string | null }>;
  const newRank = rows.findIndex((r) => r.id === input.newScoreId);
  if (newRank < 0 || newRank > 9) return;

  const displaced = rows[10];
  const displacedEmail = displaced?.email?.trim().toLowerCase();
  if (!displacedEmail) return;

  await sendPushByUserEmail(displacedEmail, {
    type: "leaderboard_knocked_out_top10",
    path: input.scorePath,
  });
}
