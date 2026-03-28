const BMC_URL = "https://buymeacoffee.com/rixou";

export function BuyCreatorsABeer({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-sm font-semibold text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 transition-colors hover:text-guinness-tan hover:decoration-guinness-gold/55 ${className}`}
      >
        Buy the Creator a Beer
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
        Buy the Creator a Beer
      </a>
    </div>
  );
}
