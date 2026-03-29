import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EN_DIR = path.join(ROOT, "app/i18n/messages/en");
const LOCALES = ["th", "fr", "es", "de", "it", "ja"];
const CACHE_FILE = path.join(ROOT, ".cache", "locale-translate-cache.json");
const LOCALE_FILTER = process.env.LOCALE?.trim();

const BASE_FILES = [
  "common.json",
  "nav.json",
  "seo.json",
  "auth.json",
  "languages.json",
  "toasts.json",
  "errors.json",
];

const PAGE_FILES = [
  "home.json",
  "descriptions.json",
  "feed.json",
  "pubs.json",
  "profile.json",
  "competitions.json",
  "competitionDetail.json",
  "score.json",
  "faq.json",
  "leaderboard.json",
  "wall.json",
  "pubDetail.json",
];

const BRAND_TOKENS = [
  "Split The G",
  "Split the G",
  "Split G",
  "Guinness",
  "Google",
  "Supabase",
  "RESEND_API_KEY",
  "APP_URL",
  "VITE_GOOGLE_MAPS_API_KEY",
  "Maps JavaScript API",
  "Places API",
];

const NAV_TERM_OVERRIDES = {
  th: { pour: "เท", feed: "ฟีด", compete: "แข่ง", pubs: "ผับ", me: "ฉัน", wall: "วอลล์", leaderboard: "จัดอันดับ", browseFeed: "ดูฟีด" },
  fr: { pour: "Verser", feed: "Fil", compete: "Défier", pubs: "Pubs", me: "Moi", wall: "Mur", leaderboard: "Classement", browseFeed: "Voir le fil" },
  es: { pour: "Servir", feed: "Feed", compete: "Competir", pubs: "Pubs", me: "Yo", wall: "Muro", leaderboard: "Ranking", browseFeed: "Ver el feed" },
  de: { pour: "Schank", feed: "Feed", compete: "Wettkampf", pubs: "Kneipen", me: "Ich", wall: "Wall", leaderboard: "Rangliste", browseFeed: "Feed ansehen" },
  it: { pour: "Versa", feed: "Feed", compete: "Sfida", pubs: "Pub", me: "Io", wall: "Wall", leaderboard: "Classifica", browseFeed: "Vedi feed" },
  ja: { pour: "注ぐ", feed: "フィード", compete: "対戦", pubs: "パブ", me: "自分", wall: "ウォール", leaderboard: "ランキング", browseFeed: "フィードを見る" },
};

const COMMON_OVERRIDES = {
  th: { buyCreatorBeer: "ซื้อเบียร์ให้ผู้สร้าง" },
  fr: { buyCreatorBeer: "Offrir une bière au créateur" },
  es: { buyCreatorBeer: "Invitar una cerveza al creador" },
  de: { buyCreatorBeer: "Dem Ersteller ein Bier spendieren" },
  it: { buyCreatorBeer: "Offri una birra al creatore" },
  ja: { buyCreatorBeer: "制作者にビールをおごる" },
};

function isRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (isRecord(v) && isRecord(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function collectStrings(node, out = new Set()) {
  if (typeof node === "string") out.add(node);
  else if (Array.isArray(node)) for (const v of node) collectStrings(v, out);
  else if (isRecord(node)) for (const v of Object.values(node)) collectStrings(v, out);
  return out;
}

function protectTokens(text) {
  const tokens = [];
  let value = text;
  const patterns = [
    /\{[^}]+\}/g,
    /https?:\/\/[^\s)"]+/g,
    ...BRAND_TOKENS.map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")),
  ];
  for (const pattern of patterns) {
    value = value.replace(pattern, (m) => {
      const key = `[[${tokens.length}]]`;
      tokens.push(m);
      return key;
    });
  }
  return { value, tokens };
}

function restoreTokens(text, tokens) {
  let out = text;
  tokens.forEach((token, i) => {
    out = out.replaceAll(`[[${i}]]`, token);
  });
  return out;
}

const cache = new Map();
let writesSinceFlush = 0;

async function loadCache() {
  try {
    const raw = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
    for (const [k, v] of Object.entries(raw)) cache.set(k, v);
    console.log(`Loaded cache entries: ${cache.size}`);
  } catch {
    // First run.
  }
}

async function flushCache(force = false) {
  if (!force && writesSinceFlush < 80) return;
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(
    CACHE_FILE,
    `${JSON.stringify(Object.fromEntries(cache.entries()))}\n`,
    "utf8",
  );
  writesSinceFlush = 0;
}

async function requestTranslate(text, locale) {
  const googleUrl =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=en&tl=${encodeURIComponent(locale)}&dt=t&q=${encodeURIComponent(text)}`;
  const memoryUrl =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(locale)}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const response = await fetch(googleUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (response.ok) {
        const raw = await response.json();
        return raw?.[0]?.map((part) => part?.[0] ?? "").join("") ?? text;
      }
    } catch {
      // Retry, then fallback.
    }
    if (attempt === 3) break;
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  const fallbackCtrl = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), 12000);
  const fallback = await fetch(memoryUrl, { signal: fallbackCtrl.signal }).finally(() =>
    clearTimeout(fallbackTimer),
  );
  if (fallback.ok) {
    const payload = await fallback.json();
    const translated = payload?.responseData?.translatedText;
    if (translated && typeof translated === "string") return translated;
  }
  throw new Error(`Translate failed for ${locale}`);
}

async function translateText(text, locale) {
  if (!text.trim()) return text;
  const key = `${locale}\n${text}`;
  if (cache.has(key)) return cache.get(key);

  const { value, tokens } = protectTokens(text);
  let translated;
  if (value.length > 1200) {
    const chunks = value
      .split("\n")
      .reduce(
        (acc, line) => {
          const curr = acc[acc.length - 1];
          if (!curr || `${curr}\n${line}`.length > 900) acc.push(line);
          else acc[acc.length - 1] = `${curr}\n${line}`;
          return acc;
        },
        /** @type {string[]} */ ([]),
      )
      .filter(Boolean);
    const translatedChunks = [];
    for (const chunk of chunks) translatedChunks.push(await requestTranslate(chunk, locale));
    translated = translatedChunks.join("\n");
  } else {
    translated = await requestTranslate(value, locale);
  }
  const restored = restoreTokens(translated, tokens);
  cache.set(key, restored);
  writesSinceFlush += 1;
  await flushCache();
  return restored;
}

async function translateNode(node, locale) {
  if (typeof node === "string") return translateText(node, locale);
  if (Array.isArray(node)) {
    const out = [];
    for (const v of node) out.push(await translateNode(v, locale));
    return out;
  }
  if (isRecord(node)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = await translateNode(v, locale);
    return out;
  }
  return node;
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function writeJson(p, value) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  await loadCache();
  const enBase = {};
  for (const file of BASE_FILES) enBase[file] = await readJson(path.join(EN_DIR, file));
  const enPages = {};
  for (const file of PAGE_FILES) enPages[file] = await readJson(path.join(EN_DIR, "pages", file));

  const allStrings = collectStrings({
    ...enBase,
    pages: enPages,
  });
  console.log(`Total source strings: ${allStrings.size}`);

  const locales = LOCALE_FILTER ? LOCALES.filter((l) => l === LOCALE_FILTER) : LOCALES;
  if (LOCALE_FILTER && locales.length === 0) {
    throw new Error(`Unsupported LOCALE filter: ${LOCALE_FILTER}`);
  }

  for (const locale of locales) {
    console.log(`\nTranslating ${locale}...`);

    const translatedBase = {};
    for (const file of BASE_FILES) {
      translatedBase[file] = await translateNode(enBase[file], locale);
      console.log(`  done ${file}`);
    }

    const translatedPages = {};
    for (const file of PAGE_FILES) {
      translatedPages[file] = await translateNode(enPages[file], locale);
      console.log(`  done pages/${file}`);
    }

    translatedBase["nav.json"] = deepMerge(translatedBase["nav.json"], NAV_TERM_OVERRIDES[locale]);
    translatedBase["common.json"] = deepMerge(
      translatedBase["common.json"],
      COMMON_OVERRIDES[locale],
    );

    for (const file of BASE_FILES) {
      await writeJson(path.join(ROOT, "app/i18n/messages", locale, file), translatedBase[file]);
    }
    for (const file of PAGE_FILES) {
      await writeJson(
        path.join(ROOT, "app/i18n/messages", locale, "pages", file),
        translatedPages[file],
      );
    }
  }

  await flushCache(true);
  console.log("\nLocale JSON generation complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
