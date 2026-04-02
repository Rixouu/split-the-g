import type { User } from "@supabase/supabase-js";
import { createContext, useContext, type FormEvent } from "react";
import type {
  FavoriteBarStats,
  FavoriteRow,
  FriendLeaderboardEntry,
  FriendRequestRow,
  ProgressRange,
  ScoreSummary,
  UserFriendRow,
} from "./profile-shared";

export type ProgressStats = {
  count: number;
  best: number;
  avg: number;
  last7: number;
  dialPct: number;
  /** Sum of `pint_price` on linked scores where price was entered. */
  totalSpend: number;
};

export type StreakSnapshot = {
  daily: number;
  weekly: number;
  weekend: number;
  updatedAt: string | null;
};

export type ProfileOutletContextValue = {
  user: User;
  scores: ScoreSummary[];
  favorites: FavoriteRow[];
  favoriteStats: Record<string, FavoriteBarStats>;
  progressStats: ProgressStats;
  progressRange: ProgressRange;
  setProgressRange: (r: ProgressRange) => void;
  friendProgressLeaderboard: FriendLeaderboardEntry[];
  friendEmail: string;
  setFriendEmail: (v: string) => void;
  sendFriendRequest: () => Promise<void>;
  acceptedFriends: UserFriendRow[];
  incomingRequests: FriendRequestRow[];
  outgoingRequests: FriendRequestRow[];
  busy: boolean;
  favName: string;
  setFavName: (v: string) => void;
  favAddress: string;
  setFavAddress: (v: string) => void;
  addFavorite: (e: FormEvent) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  respondRequest: (
    row: FriendRequestRow,
    status: "accepted" | "declined",
  ) => Promise<void>;
  cancelOutgoingFriendRequest: (row: FriendRequestRow) => Promise<void>;
  removeFriendship: (f: UserFriendRow) => Promise<void>;
  allTimeFriendStatsByEmail: Record<string, FriendLeaderboardEntry>;
  persistedAchievementCodes: string[];
  streakSnapshot: StreakSnapshot | null;
  inputClass: string;
  /** Branded toast from profile layout (e.g. share fallback). */
  showProfileToast: (message: string, title?: string) => void;
};

const ProfilePageContext = createContext<ProfileOutletContextValue | null>(
  null,
);

export function ProfilePageProvider({
  value,
  children,
}: {
  value: ProfileOutletContextValue;
  children: React.ReactNode;
}) {
  return (
    <ProfilePageContext.Provider value={value}>
      {children}
    </ProfilePageContext.Provider>
  );
}

export function useProfileOutlet(): ProfileOutletContextValue {
  const v = useContext(ProfilePageContext);
  if (!v) {
    throw new Error("useProfileOutlet must be used within the profile layout");
  }
  return v;
}
