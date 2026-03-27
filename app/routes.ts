import {
  type RouteConfig,
  index,
  route,
} from "@react-router/dev/routes";

export default [
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known.chrome-devtools.tsx",
  ),
  index("routes/home.tsx"),
  route("feed", "./routes/feed.tsx"),
  route("competitions", "./routes/competitions.tsx"),
  route("competitions/:competitionId", "./routes/competitions.$competitionId.tsx"),
  route("profile", "./routes/profile.tsx"),
  route("pubs", "./routes/pubs.tsx"),
  route("pour/:pourRef", "./routes/score/score.tsx"),
  route("score/:splitId", "./routes/score/redirect-to-pour.tsx"),
  route("leaderboard", "./routes/leaderboard/leaderboard.tsx"),
  route("api/email", "./routes/email.tsx"),
  route("wall", "./routes/collage.tsx"),
  route("collage", "./routes/collage-redirect.tsx"),
  route("countryleaderboard", "./routes/leaderboard/country-leaderboard.tsx"),
  route("past24hrleaderboard", "./routes/leaderboard/past-24hr-leaderboard.tsx"),
  route("faq", "./routes/faq.tsx"),
] satisfies RouteConfig;