export type TranslateVars = Record<string, string | number | undefined>;

/** Replace `{key}` placeholders; missing vars keep the placeholder. */
export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v != null ? String(v) : `{${k}}`;
  });
}

export type TranslateFn = (key: string, vars?: TranslateVars) => string;
