export function BuyCreatorsABeer({ className = "" }: { className?: string }) {
  return (
    <div className={`${className}`}>
      <a
        href="https://buymeacoffee.com/rixou"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center px-6 py-3 bg-guinness-gold/10 hover:bg-guinness-gold/20 text-guinness-gold border border-guinness-gold/20 rounded-lg transition-colors duration-300 font-semibold"
      >
        Buy the Creator a Beer
      </a>
    </div>
  );
}
