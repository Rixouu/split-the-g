"use client";

import type { User } from "@supabase/supabase-js";
import { Crown } from "lucide-react";
import { useId, useMemo, useState, useEffect } from "react";

const STROKE = "border-[#2A2211]";

/** Google / Supabase OAuth often expose `picture` or `avatar_url` on metadata or identities. */
export function oauthProfilePictureUrl(user: User): string | undefined {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  for (const key of ["avatar_url", "picture"] as const) {
    const v = meta?.[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const id of user.identities ?? []) {
    const d = id.identity_data as Record<string, unknown> | undefined;
    if (!d) continue;
    for (const key of ["avatar_url", "picture"] as const) {
      const v = d[key];
      if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
    }
  }
  return undefined;
}

export function DefaultProfileAvatarIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-8.433.649A7.23 7.23 0 005.25 12a7.23 7.23 0 011-3.746 7.204 7.204 0 0115.002 0 7.23 7.23 0 011 3.746 7.23 7.23 0 01-5.002 6.746zM16.706 9.706a4.25 4.25 0 11-8.5 0 4.25 4.25 0 018.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface ProfileTierAvatarSummary {
  maxTierAmongUnlocked: number;
  unlockedCount: number;
  totalCount: number;
}

const VARIANT: Record<
  "hub" | "account",
  { box: string; icon: string; crown: string; tierText: string }
> = {
  hub: {
    box: "h-[4.5rem] w-[4.5rem]",
    icon: "h-7 w-7",
    crown: "h-2.5 w-2.5",
    tierText: "text-[10px]",
  },
  account: {
    box: "h-[5.75rem] w-[5.75rem]",
    icon: "h-9 w-9",
    crown: "h-3 w-3",
    tierText: "text-xs",
  },
};

export interface ProfileTierAvatarProps {
  user: User;
  summary: ProfileTierAvatarSummary;
  variant?: "hub" | "account";
  /** Full accessible description (e.g. tier + ring progress). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Gold progress ring, avatar, crown + tier on bottom center (medallion).
 */
export function ProfileTierAvatar({
  user,
  summary,
  variant = "hub",
  ariaLabel,
  className = "",
}: ProfileTierAvatarProps) {
  const uid = useId();
  const ringGradientId = `stg-tier-ring-${uid.replace(/:/g, "")}`;
  const photoUrl = useMemo(() => oauthProfilePictureUrl(user), [user]);
  const [loadFailed, setLoadFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !loadFailed;
  const v = VARIANT[variant];

  useEffect(() => {
    setLoadFailed(false);
  }, [photoUrl, user.id]);

  const total = summary.totalCount;
  const unlocked = summary.unlockedCount;
  const ringCirc = 2 * Math.PI * 21;
  const ringFillRatio =
    total > 0 ? Math.min(1, Math.max(0.06, unlocked / total)) : 0.1;
  const ringDash = ringFillRatio * ringCirc;

  const showTier =
    summary.unlockedCount > 0 && summary.maxTierAmongUnlocked > 0;

  return (
    <div
      className={`relative ${v.box} shrink-0 ${className}`.trim()}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <svg
        className="pointer-events-none absolute left-1/2 top-0 h-[78%] w-[78%] -translate-x-1/2 -rotate-90"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={ringGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(212 175 55)" stopOpacity="0.95" />
            <stop offset="55%" stopColor="rgb(245 220 140)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="rgb(180 140 50)" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <circle
          cx="36"
          cy="36"
          r="21"
          stroke="rgba(42,34,17,0.9)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="36"
          cy="36"
          r="21"
          stroke={`url(#${ringGradientId})`}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${ringDash} ${ringCirc}`}
          className="drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
        />
      </svg>
      <div
        className={`absolute left-1/2 top-[42%] aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 ${STROKE} bg-guinness-brown/45 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.15),0_0_24px_rgba(0,0,0,0.4)] ${
          variant === "account" ? "max-w-[4.15rem]" : "max-w-[3.35rem]"
        }`}
      >
        {showPhoto ? (
          <img
            key={photoUrl}
            src={photoUrl}
            alt=""
            width={128}
            height={128}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-guinness-gold/45">
            <DefaultProfileAvatarIcon className={v.icon} />
          </div>
        )}
      </div>
      {showTier ? (
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-[18%] items-center gap-0.5 rounded-full border border-guinness-gold/55 bg-gradient-to-b from-guinness-black to-guinness-black/95 px-2 py-0.5 text-guinness-gold shadow-[0_4px_16px_rgba(0,0,0,0.7),0_0_0_1px_rgba(212,175,55,0.25)]"
          aria-hidden
        >
          <Crown
            className={`${v.crown} shrink-0 fill-guinness-gold/90 text-guinness-gold`}
            strokeWidth={1.75}
          />
          <span
            className={`font-bold tabular-nums leading-none ${v.tierText}`}
          >
            {summary.maxTierAmongUnlocked}
          </span>
        </div>
      ) : null}
    </div>
  );
}
