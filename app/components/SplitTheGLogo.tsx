interface SplitTheGLogoProps {
  className?: string;
}

export function SplitTheGLogo({ className = "" }: SplitTheGLogoProps) {
  return (
    <img
      src="/logo-splittheg.svg"
      alt="Split the G"
      className={`h-auto w-full max-w-[min(100%,20rem)] md:max-w-[24rem] ${className}`}
      width={595}
      height={117}
      decoding="async"
    />
  );
}
