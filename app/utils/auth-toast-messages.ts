/**
 * Playful, day-aware copy for auth toasts — Split the G / Guinness context.
 * Used by GlobalAuthToast (sign-in) and profile sign-out.
 */

function pickIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % modulo;
}

/** First word or whole nickname — keeps “The Duke” as one token if no space. */
function toastFirstName(preferredName: string): string {
  const t = preferredName.trim();
  if (!t) return "there";
  const parts = t.split(/\s+/);
  return parts[0] ?? t;
}

/** 0 = Sunday … 6 = Saturday */
const SIGN_IN_BY_DAY: Record<number, readonly string[]> = {
  0: [
    "{name}, easy Sunday—ideal for a slow sip and a clean split on the G.",
    "Welcome back, {name}. Sunday Guinness and a steady hand on the harp.",
  ],
  1: [
    "{name}, new week—fresh chances to split the G. Glad you're here.",
    "Monday mode, {name}? The pint and the G are waiting when you are.",
  ],
  2: [
    "{name}, Tuesday's sorted—you're in. Pour when the craving hits.",
    "Hey {name}. Midweek energy: line up the harp and split the G.",
  ],
  3: [
    "{name}, halfway through the week. Perfect night to chase a sharper split.",
    "Welcome, {name}. Wednesday calls for a well-poured Guinness.",
  ],
  4: [
    "{name}, almost Friday—sign in locked. Split the G this weekend?",
    "Thursday, {name}. You're in; the next perfect pour is yours to hunt.",
  ],
  5: [
    "{name}, Friday pour energy. Welcome back—may your foam sit on the G.",
    "TGIF, {name}. Guinness, mates, and a clean split—good combo.",
  ],
  6: [
    "{name}, Saturday night potential. Welcome back to the scorer.",
    "Weekend, {name}. Time to split the G somewhere worth remembering.",
  ],
};

const SIGN_OUT_BY_DAY: Record<number, readonly string[]> = {
  0: [
    "{name}, enjoy the rest of your Sunday. You're signed out.",
    "Take it easy, {name}. The harp'll wait—You're signed out.",
  ],
  1: [
    "{name}, see you for the next pour. You're signed out.",
    "Monday waits for no one—except your next Guinness, {name}. You're signed out.",
  ],
  2: [
    "{name}, catch you after work. You're signed out.",
    "Stay steady, {name}. Split the G again soon—You're signed out.",
  ],
  3: [
    "{name}, thanks for stopping by. You're signed out.",
    "Midweek break, {name}. You're signed out.",
  ],
  4: [
    "{name}, almost the weekend—You're signed out.",
    "{name}, see you Friday or sooner. You're signed out.",
  ],
  5: [
    "{name}, go enjoy that pint. You're signed out.",
    "Friday night, {name}—You're signed out. Split the G when you're back.",
  ],
  6: [
    "{name}, have a great weekend. You're signed out.",
    "{name}, the pub can wait—you're signed out for now.",
  ],
};

function linesForDay(
  map: Record<number, readonly string[]>,
  day: number,
): readonly string[] {
  return map[day] ?? map[1] ?? SIGN_IN_BY_DAY[1]!;
}

export function signInToastCopy(preferredName: string): {
  title: string;
  message: string;
} {
  const name = toastFirstName(preferredName);
  const day = new Date().getDay();
  const pool = linesForDay(SIGN_IN_BY_DAY, day);
  const line = pool[pickIndex(`in-${name}-${day}-${pool.length}`, pool.length)]!;
  const message = line.replace(/\{name\}/g, name);
  return {
    title: `Welcome, ${name}`,
    message,
  };
}

/** Body for profile BrandedToast; must include “signed out” for success variant matching. */
export function signOutToastCopy(preferredName: string): string {
  const name = toastFirstName(preferredName);
  const day = new Date().getDay();
  const pool = linesForDay(SIGN_OUT_BY_DAY, day);
  const line = pool[pickIndex(`out-${name}-${day}-${pool.length}`, pool.length)]!;
  return line.replace(/\{name\}/g, name);
}
