import { NATIVE_SELECT_APPEARANCE_CLASS } from "~/utils/native-select-classes";

export interface CompetitionRow {
  id: string;
  title: string;
  created_by: string;
  max_participants: number;
  glasses_per_person: number;
  starts_at: string;
  ends_at: string;
  win_rule: string;
  target_score?: number | null;
  created_at: string;
  visibility?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  linked_bar_key?: string | null;
  /** Pretty URL segment for `/competitions/:segment` (set by DB trigger). */
  path_segment?: string | null;
}

export type WinRuleChoice =
  | "highest_score"
  | "lowest_score"
  | "best_average"
  | "closest_to_target"
  | "most_submissions";

/** Stored when pours per person are unlimited (most-submissions rule). */
export const GLASSES_PER_PERSON_UNLIMITED_SENTINEL = 9999;

export function winRuleUsesUnlimitedGlasses(winRule: string): boolean {
  return winRule === "most_submissions";
}

export function isStoredGlassesUnlimited(n: number): boolean {
  return n >= GLASSES_PER_PERSON_UNLIMITED_SENTINEL;
}

export function normalizeWinRuleChoice(
  raw: string | null | undefined,
): WinRuleChoice {
  switch (raw) {
    case "highest_score":
    case "lowest_score":
    case "best_average":
    case "closest_to_target":
    case "most_submissions":
      return raw;
    default:
      return "highest_score";
  }
}

export interface FriendPick {
  friend_user_id: string;
  peer_email: string | null;
}

export interface InviteRow {
  id: string;
  invited_email: string;
}

export interface BarLinkOption {
  bar_key: string;
  display_name: string;
}

export const COMPETITION_ROW_SELECT =
  "id, title, created_by, max_participants, glasses_per_person, starts_at, ends_at, win_rule, target_score, created_at, visibility, location_name, location_address, linked_bar_key, path_segment";

export const competitionOutlineButtonClass =
  "rounded-lg border border-guinness-gold/30 px-3 py-1.5 text-xs font-semibold text-guinness-gold hover:bg-guinness-brown/50 disabled:opacity-40";

const competitionFieldShell =
  "w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/60 py-2 text-guinness-cream focus:border-guinness-gold focus:outline-none";

export const competitionFieldClass = `${competitionFieldShell} px-3`;

/** Native `<select>` only — custom chevron inset from the right edge. */
export const competitionSelectFieldClass = `${competitionFieldShell} pl-3 ${NATIVE_SELECT_APPEARANCE_CLASS}`;

export function winRuleLabel(rule: string): string {
  switch (rule) {
    case "closest_to_target":
      return "Closest to target";
    case "most_submissions":
      return "Most submissions";
    case "lowest_score":
      return "Lowest split score";
    case "best_average":
      return "Best average score";
    default:
      return "Highest score";
  }
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isPrivateCompetition(c: CompetitionRow): boolean {
  return (c.visibility ?? "public") === "private";
}

/** Gold band along the top inside list / detail competition cards. */
export const competitionCardTopLightClass =
  "pointer-events-none absolute inset-x-0 top-0 z-[1] h-1 bg-gradient-to-r from-transparent via-guinness-gold/55 to-transparent opacity-90";

/** Outer shell for competition row cards (list) and detail summary. */
export const competitionCardFrameClass =
  "rounded-2xl border border-solid border-guinness-frame bg-gradient-to-br from-guinness-brown/45 via-guinness-black/20 to-guinness-black/40 shadow-[0_10px_36px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(212,175,55,0.08)]";

export const competitionCardDividerClass = "border-solid border-guinness-frame";

/** Inner stat tile — matches competitions list grid cells. */
export const competitionStatCellClass =
  "flex flex-col rounded-xl border border-solid border-guinness-frame bg-black/30 px-3 py-2.5";
