/** Shared select lists for feed / collage / leaderboard (includes `slug` for /pour/{slug} links). */
export const SCORES_LIST_COLUMNS = `
  id,
  slug,
  username,
  pint_image_url,
  created_at,
  split_score,
  bar_name,
  bar_address,
  city,
  region,
  country_code,
  pint_price
`;

/** Collage / submissions grid (includes split image). */
export const SCORES_COLLAGE_COLUMNS = `
  id,
  slug,
  username,
  split_image_url,
  pint_image_url,
  created_at,
  city,
  region,
  country,
  country_code,
  split_score,
  bar_name,
  bar_address
`;

export const SCORES_LEADERBOARD_COLUMNS = `
  id,
  slug,
  username,
  split_score,
  created_at,
  split_image_url
`;
