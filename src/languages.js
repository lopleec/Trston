export const SUPPORTED_LANGUAGES = [
  { code: "ar", name: "Arabic", nativeName: "العربية", zhName: "阿拉伯语" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", zhName: "保加利亚语" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", zhName: "孟加拉语" },
  { code: "cs", name: "Czech", nativeName: "Cestina", zhName: "捷克语" },
  { code: "da", name: "Danish", nativeName: "Dansk", zhName: "丹麦语" },
  { code: "en", name: "English", nativeName: "English", zhName: "英语" },
  { code: "de", name: "German", nativeName: "Deutsch", zhName: "德语" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", zhName: "希腊语" },
  { code: "fr", name: "French", nativeName: "Francais", zhName: "法语" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", zhName: "芬兰语" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", zhName: "印地语" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", zhName: "克罗地亚语" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", zhName: "匈牙利语" },
  { code: "id", name: "Indonesian", nativeName: "Indonesia", zhName: "印尼语" },
  { code: "it", name: "Italian", nativeName: "Italiano", zhName: "意大利语" },
  { code: "iw", name: "Hebrew", nativeName: "עברית", zhName: "希伯来语" },
  { code: "ja", name: "Japanese", nativeName: "日本語", zhName: "日语" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", zhName: "卡纳达语" },
  { code: "ko", name: "Korean", nativeName: "한국어", zhName: "韩语" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuviu", zhName: "立陶宛语" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", zhName: "马拉地语" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", zhName: "荷兰语" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", zhName: "挪威语" },
  { code: "pl", name: "Polish", nativeName: "Polski", zhName: "波兰语" },
  { code: "pt", name: "Portuguese", nativeName: "Portugues", zhName: "葡萄牙语" },
  { code: "ro", name: "Romanian", nativeName: "Romana", zhName: "罗马尼亚语" },
  { code: "es", name: "Spanish", nativeName: "Espanol", zhName: "西班牙语" },
  { code: "ru", name: "Russian", nativeName: "Русский", zhName: "俄语" },
  { code: "sk", name: "Slovak", nativeName: "Slovencina", zhName: "斯洛伐克语" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenscina", zhName: "斯洛文尼亚语" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", zhName: "瑞典语" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", zhName: "泰米尔语" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", zhName: "泰卢固语" },
  { code: "th", name: "Thai", nativeName: "ไทย", zhName: "泰语" },
  { code: "tr", name: "Turkish", nativeName: "Turkce", zhName: "土耳其语" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", zhName: "乌克兰语" },
  { code: "vi", name: "Vietnamese", nativeName: "Tieng Viet", zhName: "越南语" },
  { code: "zh", name: "Chinese", nativeName: "中文", zhName: "中文" },
  { code: "zh-Hant", name: "Chinese (Traditional)", nativeName: "繁體中文", zhName: "繁体中文" }
];

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((language) => language.code);

export const DEFAULT_SETTINGS = {
  targetLanguage: "zh",
  showOverlay: true,
  autoTranslate: true,
  streamTranslation: true,
  translateTitle: true,
  neverTranslateLanguages: [],
  neverTranslateSites: [],
  maxNodes: 900,
  batchSize: 14,
  viewportMarginScreens: 1.35
};

const LANGUAGE_ALIASES = new Map([
  ["zh-cn", "zh"],
  ["zh-hans", "zh"],
  ["zh-sg", "zh"],
  ["zh-my", "zh"],
  ["zh-tw", "zh-Hant"],
  ["zh-hk", "zh-Hant"],
  ["zh-mo", "zh-Hant"],
  ["zh-hant", "zh-Hant"],
  ["cn", "zh"],
  ["jp", "ja"],
  ["he", "iw"],
  ["ger", "de"],
  ["deu", "de"],
  ["fre", "fr"],
  ["fra", "fr"],
  ["spa", "es"],
  ["rus", "ru"],
  ["eng", "en"]
]);

export function normalizeLanguageCode(value) {
  if (!value) {
    return null;
  }

  const cleaned = String(value).trim().replace(/_/g, "-").toLowerCase();
  if (!cleaned) {
    return null;
  }

  if (LANGUAGE_ALIASES.has(cleaned)) {
    return LANGUAGE_ALIASES.get(cleaned);
  }

  const canonical = SUPPORTED_LANGUAGE_CODES.find((code) => code.toLowerCase() === cleaned);
  if (canonical) {
    return canonical;
  }

  const base = cleaned.split("-")[0];
  if (SUPPORTED_LANGUAGE_CODES.includes(base)) {
    return base;
  }

  return null;
}

export function isSupportedLanguage(value) {
  return SUPPORTED_LANGUAGE_CODES.includes(normalizeLanguageCode(value));
}

export function getLanguageMeta(value) {
  const code = normalizeLanguageCode(value);
  return SUPPORTED_LANGUAGES.find((language) => language.code === code) ?? null;
}

export function getLanguageLabel(value, locale = "zh") {
  const language = getLanguageMeta(value);
  if (!language) {
    return "Unknown";
  }

  if (String(locale).toLowerCase().startsWith("zh")) {
    return `${language.zhName} / ${language.nativeName}`;
  }

  return `${language.name} / ${language.nativeName}`;
}

export function coerceSettings(settings = {}) {
  const targetLanguage = normalizeLanguageCode(settings.targetLanguage) ?? DEFAULT_SETTINGS.targetLanguage;
  const maxNodes = clampNumber(settings.maxNodes, 80, 5000, DEFAULT_SETTINGS.maxNodes);
  const batchSize = clampNumber(settings.batchSize, 4, 40, DEFAULT_SETTINGS.batchSize);
  const neverTranslateLanguages = normalizeLanguageList(settings.neverTranslateLanguages);
  const neverTranslateSites = normalizeSiteList(settings.neverTranslateSites);
  const viewportMarginScreens = clampNumber(
    Number(settings.viewportMarginScreens) * 100,
    50,
    300,
    DEFAULT_SETTINGS.viewportMarginScreens * 100
  ) / 100;

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    targetLanguage,
    showOverlay: settings.showOverlay !== false,
    autoTranslate: settings.autoTranslate !== false,
    streamTranslation: settings.streamTranslation !== false,
    translateTitle: settings.translateTitle !== false,
    neverTranslateLanguages,
    neverTranslateSites,
    maxNodes,
    batchSize,
    viewportMarginScreens
  };
}

function normalizeLanguageList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeLanguageCode).filter(Boolean))];
}

function normalizeSiteList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeSitePattern).filter(Boolean))];
}

export function normalizeSitePattern(value) {
  const text = normalizeInputHostSeparators(String(value ?? "").trim().toLowerCase().replace(/\s+/g, ""));
  if (!text) {
    return null;
  }

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
    const parsed = new URL(withProtocol);
    const host = normalizeSiteHost(parsed.hostname);
    const path = normalizeSitePath(parsed.pathname);
    return host ? `${host}${path}` : null;
  } catch {
    const body = text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const boundary = body.search(/[/?#]/);
    const hostText = boundary === -1 ? body : body.slice(0, boundary);
    const rest = boundary === -1 ? "" : body.slice(boundary);
    const host = normalizeSiteHost(hostText);
    const path = rest.startsWith("/") ? normalizeSitePath(rest.split(/[?#]/)[0]) : "";
    return host ? `${host}${path}` : null;
  }
}

export function sitePatternMatchesUrl(pattern, url) {
  const normalizedPattern = normalizeSitePattern(pattern);
  if (!normalizedPattern) {
    return false;
  }

  let parsedUrl;
  try {
    parsedUrl = url instanceof URL ? url : new URL(String(url));
  } catch {
    return false;
  }

  const { host: patternHost, path: patternPath } = splitSitePattern(normalizedPattern);
  const currentHost = normalizeSiteHost(parsedUrl.hostname);
  const currentPath = normalizeSitePath(parsedUrl.pathname) || "/";
  const hostMatches = currentHost === patternHost || currentHost.endsWith(`.${patternHost}`);

  if (!hostMatches) {
    return false;
  }

  if (!patternPath) {
    return true;
  }

  return currentPath === patternPath || currentPath.startsWith(`${patternPath}/`);
}

function normalizeInputHostSeparators(text) {
  const protocolMatch = text.match(/^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i);
  if (protocolMatch) {
    return `${protocolMatch[1]}${normalizeInputHostSeparators(protocolMatch[2])}`;
  }

  const boundary = text.search(/[/?#]/);
  const hostText = boundary === -1 ? text : text.slice(0, boundary);
  const rest = boundary === -1 ? "" : text.slice(boundary);
  return `${hostText.replace(/[，,]/g, ".")}${rest}`;
}

function normalizeSiteHost(hostname) {
  return String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/[，,]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function normalizeSitePath(pathname) {
  const path = String(pathname ?? "")
    .trim()
    .toLowerCase()
    .split(/[?#]/)[0]
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/g, "");

  if (!path || path === "/") {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function splitSitePattern(pattern) {
  const slashIndex = pattern.indexOf("/");
  if (slashIndex === -1) {
    return { host: pattern, path: "" };
  }

  return {
    host: pattern.slice(0, slashIndex),
    path: pattern.slice(slashIndex)
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
