import { useCallback, useEffect, useMemo, useState } from "react";

export interface ScoreSharePanelProps {
  sharePath: string;
  splitScore: number;
  allTimeRank: number;
  totalSplits: number;
  weeklyRank: number;
  weeklyTotalSplits: number;
}

const btnBase =
  "flex flex-col items-center justify-center gap-1.5 rounded-xl bg-guinness-black/45 px-2 py-3 text-center ring-1 ring-guinness-gold/10 transition-[background-color,box-shadow] hover:bg-guinness-gold/12 hover:ring-guinness-gold/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinness-gold min-h-[4.25rem] sm:min-h-[4.5rem]";

const iconClass = "h-6 w-6 shrink-0 text-guinness-gold";

/** Short challenge line for the preview and for tight social snippets. */
export function shareChallengeHeadline(splitScore: number): string {
  if (splitScore >= 4.5) {
    return "Think you can split the G cleaner than this pour?";
  }
  if (splitScore >= 3.5) {
    return "Your turn — beat my line and show the feed.";
  }
  return "Pour yours on Split the G and try to score higher.";
}

/** Full message for clipboard, email, WhatsApp, and native share. */
export function buildScoreShareMessage(params: {
  shareUrl: string;
  splitScore: number;
  allTimeRank: number;
  totalSplits: number;
  weeklyRank: number;
  weeklyTotalSplits: number;
}): string {
  const s = params.splitScore.toFixed(2);
  const hook = shareChallengeHeadline(params.splitScore);
  return (
    `${hook}\n\n` +
    `I scored ${s}/5 on Split the G — all-time #${params.allTimeRank} of ${params.totalSplits}, weekly #${params.weeklyRank} of ${params.weeklyTotalSplits}.\n\n` +
    `Your move: open the link, photograph your pint, and get your line scored on the same wall (free):\n` +
    `${params.shareUrl}`
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.289.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IconReddit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.498l1.132-5.303a.251.251 0 0 1 .181-.228 1.09 1.09 0 0 1 .29-.07l2.905.617a1.218 1.218 0 0 1 1.008-1.204zM8.372 14.5c-.516 0-.935.418-.935.935 0 .516.419.935.935.935a.94.94 0 0 0 .935-.935.94.94 0 0 0-.935-.935zm7.215 0c-.516 0-.935.418-.935.935 0 .516.419.935.935.935a.94.94 0 0 0 .935-.935.94.94 0 0 0-.935-.935zm-3.607 3.682c-1.1.08-2.245-.283-2.245-.283 0 0 .353 1.282 2.245 1.282 1.893 0 2.246-1.282 2.246-1.282s-1.145.363-2.246.283z" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconShareSystem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * Branded share block for pour results: preview card + deep links for major networks
 * (WhatsApp, X, Telegram, Facebook, Reddit), email, copy, and native share when available.
 */
export function ScoreSharePanel({
  sharePath,
  splitScore,
  allTimeRank,
  totalSplits,
  weeklyRank,
  weeklyTotalSplits,
}: ScoreSharePanelProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState<"text" | "link" | null>(null);

  useEffect(() => {
    setShareUrl(`${window.location.origin}${sharePath}`);
  }, [sharePath]);

  const shareText = useMemo(() => {
    if (!shareUrl) return "";
    return buildScoreShareMessage({
      shareUrl,
      splitScore,
      allTimeRank,
      totalSplits,
      weeklyRank,
      weeklyTotalSplits,
    });
  }, [
    shareUrl,
    splitScore,
    allTimeRank,
    totalSplits,
    weeklyRank,
    weeklyTotalSplits,
  ]);

  const tweetText = useMemo(() => {
    if (!shareUrl) return "";
    const s = splitScore.toFixed(2);
    const hook = shareChallengeHeadline(splitScore);
    const compact = `${hook} I scored ${s}/5 on Split the G. Pour yours: ${shareUrl}`;
    return compact.length > 280 ? `${hook} ${s}/5 on Split the G — ${shareUrl}` : compact;
  }, [shareUrl, splitScore]);

  const telegramBlurb = useMemo(() => {
    const s = splitScore.toFixed(2);
    const hook = shareChallengeHeadline(splitScore);
    return `${hook} I scored ${s}/5 — open the link to pour yours and get scored.`;
  }, [splitScore]);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const openHref = useCallback((href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  }, []);

  const copyFullText = useCallback(async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied("text");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, [shareText]);

  const copyLinkOnly = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("link");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, [shareUrl]);

  const nativeShare = useCallback(async () => {
    if (!canNativeShare || !shareText) return;
    try {
      await navigator.share({
        title: `Split the G challenge — ${splitScore.toFixed(2)}/5`,
        text: shareText,
        url: shareUrl || undefined,
      });
    } catch {
      /* dismissed or unavailable */
    }
  }, [canNativeShare, shareText, shareUrl, splitScore]);

  const mailtoHref = useMemo(() => {
    if (!shareText) return "";
    const subject = `Split the G challenge — ${splitScore.toFixed(2)}/5`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
  }, [shareText, splitScore]);

  const links = useMemo(() => {
    if (!shareUrl || !shareText) return null;
    const redditTitle = `Split the G — scored ${splitScore.toFixed(2)}/5. Can you beat this pour?`;
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(telegramBlurb)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(redditTitle)}`,
    };
  }, [shareUrl, shareText, tweetText, telegramBlurb, splitScore]);

  const scoreLabel = splitScore.toFixed(2);
  const previewHook = shareChallengeHeadline(splitScore);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="type-card-title text-guinness-gold">Share your split</h2>
        <p className="type-meta mt-1 text-guinness-tan/65">
          What you send includes your score and a link so they can pour theirs and get rated too.
        </p>
      </div>

      <div
        className="rounded-xl bg-guinness-black/25 px-4 py-5 sm:px-5 sm:py-6"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <img
            src="/logo-splittheg.svg"
            alt="Split the G"
            width={595}
            height={117}
            decoding="async"
            className="h-8 w-auto max-w-[10.5rem] shrink-0 object-contain opacity-95 sm:h-9 sm:max-w-[11.5rem]"
          />
          <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
            <p className="text-[15px] font-semibold leading-snug text-guinness-cream sm:text-base">
              {previewHook}
            </p>
            <p className="type-meta text-guinness-tan/70">
              Anyone you challenge uses this link to pour theirs, photograph the pint, and get a G line score — same wall and leaderboards you’re on.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2 border-t border-guinness-gold/15 pt-5">
          <p className="text-center text-3xl font-bold tabular-nums text-guinness-gold sm:text-left sm:text-4xl">
            {scoreLabel}
            <span className="text-xl font-semibold text-guinness-tan/70 sm:text-2xl"> / 5.0</span>
          </p>
          <ul className="type-meta space-y-0.5 text-center text-guinness-cream/90 sm:text-left">
            <li>
              All-time rank: <span className="font-semibold text-guinness-tan">#{allTimeRank}</span> of{" "}
              {totalSplits}
            </li>
            <li>
              Weekly rank: <span className="font-semibold text-guinness-tan">#{weeklyRank}</span> of{" "}
              {weeklyTotalSplits}
            </li>
          </ul>
          <p className="truncate pt-1 text-center font-mono text-[11px] text-guinness-tan/50 sm:text-left sm:text-xs">
            {shareUrl || "…"}
          </p>
        </div>
      </div>

      {links ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-guinness-black/15 p-2 sm:grid-cols-4 sm:p-2.5">
          <button type="button" className={btnBase} onClick={() => openHref(links.whatsapp)}>
            <IconWhatsApp className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              WhatsApp
            </span>
          </button>
          <button type="button" className={btnBase} onClick={() => openHref(links.telegram)}>
            <IconTelegram className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              Telegram
            </span>
          </button>
          <button type="button" className={btnBase} onClick={() => openHref(links.x)}>
            <IconX className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              X
            </span>
          </button>
          <button type="button" className={btnBase} onClick={() => openHref(links.facebook)}>
            <IconFacebook className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              Facebook
            </span>
          </button>
          <button type="button" className={btnBase} onClick={() => openHref(links.reddit)}>
            <IconReddit className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              Reddit
            </span>
          </button>
          <a href={mailtoHref} className={`${btnBase} no-underline`}>
            <IconMail className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              Email
            </span>
          </a>
          <button type="button" className={btnBase} onClick={() => void copyFullText()}>
            <IconCopy className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              {copied === "text" ? "Copied" : "Copy text"}
            </span>
          </button>
          <button type="button" className={btnBase} onClick={() => void copyLinkOnly()}>
            <IconLink className={iconClass} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-guinness-cream sm:text-xs">
              {copied === "link" ? "Copied" : "Copy link"}
            </span>
          </button>
        </div>
      ) : null}

      {canNativeShare && shareText ? (
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-guinness-gold/10 px-4 py-2.5 text-sm font-semibold text-guinness-gold ring-1 ring-guinness-gold/25 transition-colors hover:bg-guinness-gold/15 hover:ring-guinness-gold/40"
        >
          <IconShareSystem className="h-5 w-5 text-guinness-gold" />
          Share via device…
        </button>
      ) : null}

      <p className="type-meta text-center text-guinness-tan/45">
        Instagram has no web share — use{" "}
        <span className="font-semibold text-guinness-tan/55">Copy text</span> or{" "}
        <span className="font-semibold text-guinness-tan/55">Copy link</span>, then paste in the app.
      </p>
    </div>
  );
}
