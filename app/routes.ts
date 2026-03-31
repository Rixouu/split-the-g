import {
  type RouteConfig,
  index,
  route,
} from "@react-router/dev/routes";

export default [
  route("wp-admin/*", "routes/bot-probe.tsx"),
  route("wordpress/wp-admin/*", "routes/bot-probe.tsx"),
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known.chrome-devtools.tsx",
  ),
  route("api/email", "./routes/email.tsx"),
  route("api/friend-invite", "./routes/friend-invite-email.tsx"),
  index("routes/root-redirect.tsx"),
  route(":lang", "routes/lang-layout.tsx", [
    index("routes/home.tsx"),
    route("feed", "./routes/feed.tsx"),
    route("competitions", "./routes/competitions.tsx"),
    route("competitions/new", "./routes/competitions.new.tsx"),
    route(
      "competitions/:competitionId/edit",
      "./routes/competitions.$competitionId.edit.tsx",
    ),
    route(
      "competitions/:competitionId",
      "./routes/competitions.$competitionId.tsx",
    ),
    route("profile", "routes/profile/layout.tsx", [
      index("routes/profile/_index.tsx"),
      route("account", "routes/profile/account.tsx"),
      route("progress", "routes/profile/progress.tsx"),
      route("expenses", "routes/profile/expenses.tsx"),
      route("scores", "routes/profile/scores.tsx"),
      route("favorites", "routes/profile/favorites.tsx"),
      route("friends", "routes/profile/friends.tsx"),
      route("faq", "./routes/faq.tsx"),
    ]),
    route("pubs", "./routes/pubs.tsx"),
    route("pubs/:barKey", "./routes/pubs.$barKey.tsx"),
    route("pour/:pourRef", "./routes/score/score.tsx"),
    route("score/:splitId", "./routes/score/redirect-to-pour.tsx"),
    route("leaderboard", "./routes/leaderboard/leaderboard.tsx"),
    route("wall", "./routes/collage.tsx"),
    route(
      "countryleaderboard",
      "./routes/leaderboard/country-leaderboard.tsx",
    ),
    route(
      "past24hrleaderboard",
      "./routes/leaderboard/past-24hr-leaderboard.tsx",
    ),
  ]),
  route("collage", "./routes/collage-redirect.tsx"),
  route("faq", "./routes/faq-redirect.tsx"),
] satisfies RouteConfig;
