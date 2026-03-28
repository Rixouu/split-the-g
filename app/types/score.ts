export interface Score {
  id: string;
  /** Short public segment for /pour/{slug} */
  slug?: string | null;
  created_at: string;
  split_score: number;
  split_image_url: string;
  pint_image_url: string;
  g_closeup_image_url?: string | null;
  username: string;
  email?: string;
  email_opted_out?: boolean;
  session_id?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  bar_name?: string;
  bar_address?: string;
  /** From Places when the pourer picked a suggestion. */
  google_place_id?: string | null;
  pour_rating?: number;
  /** Optional amount paid for the pint (local currency). */
  pint_price?: number | null;
}
