import type { TranslateFn } from "./translate";

function pickIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % modulo;
}

function toastFirstName(preferredName: string): string {
  const s = preferredName.trim();
  if (!s) return "there";
  const parts = s.split(/\s+/);
  return parts[0] ?? s;
}

function signInLinesForDay(t: TranslateFn, day: number, name: string): string[] {
  const base = `auth.signIn.day${day}`;
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const msg = t(`${base}.${i}`, { name });
    if (msg === `${base}.${i}`) break;
    out.push(msg);
  }
  if (out.length === 0) {
    for (let i = 0; i < 8; i++) {
      const msg = t(`auth.signIn.day1.${i}`, { name });
      if (msg === `auth.signIn.day1.${i}`) break;
      out.push(msg);
    }
  }
  return out;
}

function signOutLinesForDay(t: TranslateFn, day: number, name: string): string[] {
  const base = `auth.signOut.day${day}`;
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const msg = t(`${base}.${i}`, { name });
    if (msg === `${base}.${i}`) break;
    out.push(msg);
  }
  if (out.length === 0) {
    for (let i = 0; i < 8; i++) {
      const msg = t(`auth.signOut.day1.${i}`, { name });
      if (msg === `auth.signOut.day1.${i}`) break;
      out.push(msg);
    }
  }
  return out;
}

export function signInToastFromT(
  t: TranslateFn,
  preferredName: string,
): { title: string; message: string } {
  const name = toastFirstName(preferredName);
  const day = new Date().getDay();
  const pool = signInLinesForDay(t, day, name);
  const line =
    pool[pickIndex(`in-${name}-${day}-${pool.length}`, pool.length)] ??
    t("auth.signIn.day1.0", { name });
  return {
    title: t("auth.signInTitle", { name }),
    message: line,
  };
}

export function signOutToastFromT(t: TranslateFn, preferredName: string): string {
  const name = toastFirstName(preferredName);
  const day = new Date().getDay();
  const pool = signOutLinesForDay(t, day, name);
  return (
    pool[pickIndex(`out-${name}-${day}-${pool.length}`, pool.length)] ??
    t("auth.signOut.day1.0", { name })
  );
}
