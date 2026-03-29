import common from "./common.json";
import nav from "./nav.json";
import seo from "./seo.json";
import auth from "./auth.json";
import languages from "./languages.json";
import toasts from "./toasts.json";
import errors from "./errors.json";
import home from "./pages/home.json";
import descriptions from "./pages/descriptions.json";
import feed from "./pages/feed.json";
import pubs from "./pages/pubs.json";
import profile from "./pages/profile.json";
import competitions from "./pages/competitions.json";
import competitionDetail from "./pages/competitionDetail.json";
import score from "./pages/score.json";
import faq from "./pages/faq.json";
import leaderboard from "./pages/leaderboard.json";
import wall from "./pages/wall.json";
import pubDetail from "./pages/pubDetail.json";

const bundle = {
  common,
  nav,
  seo,
  auth,
  languages,
  toasts,
  errors,
  pages: {
    home,
    descriptions,
    feed,
    pubs,
    profile,
    competitions,
    competitionDetail,
    score,
    faq,
    leaderboard,
    wall,
    pubDetail,
  },
};

export default bundle;
