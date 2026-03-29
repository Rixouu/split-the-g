import { useI18n } from "~/i18n/context";

const BMC_URL = "https://buymeacoffee.com/rixou";

export function BuyCreatorABeer({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "compact" | "micro";
}) {
  const { t } = useI18n();
  const label = t("common.buyCreatorBeer");

  if (variant === "micro") {
    return (
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-guinness-tan/45 underline decoration-guinness-tan/25 underline-offset-[3px] transition-colors hover:text-guinness-gold/90 hover:decoration-guinness-gold/40 ${className}`}
      >
        {label}
        <span aria-hidden className="ml-0.5 text-guinness-tan/35">
          ↗
        </span>
      </a>
    );
  }

  if (variant === "compact") {
    return (
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-sm font-semibold text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 transition-colors hover:text-guinness-tan hover:decoration-guinness-gold/55 ${className}`}
      >
        {label}
        <span aria-hidden className="text-guinness-tan/60">
          ↗
        </span>
      </a>
    );
  }

  return (
    <div className={className}>
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-lg border border-guinness-gold/20 bg-guinness-gold/10 px-6 py-3 font-semibold text-guinness-gold transition-colors duration-300 hover:bg-guinness-gold/20"
      >
        {label}
      </a>
    </div>
  );
}
