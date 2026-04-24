import {
  SUPPORTED_LANGUAGE_CODES,
  getLanguageLabel,
  normalizeLanguageCode
} from "./languages.js";
import {
  getFallbackDictionaryStats,
  translateWithLocalGlossary
} from "./fallback_dictionary.js";

const translatorCache = new Map();
let languageDetectorPromise = null;

export async function getCapabilityStatus(options = {}) {
  const sourceLanguage = normalizeLanguageCode(options.sourceLanguage) ?? "en";
  const targetLanguage = normalizeLanguageCode(options.targetLanguage) ?? "zh";
  const translatorSupported = hasGlobalApi("Translator");
  const detectorSupported = hasGlobalApi("LanguageDetector");
  let pairAvailability = null;
  let detectorAvailability = null;
  let error = null;

  try {
    if (translatorSupported && self.Translator.availability) {
      pairAvailability = await self.Translator.availability({
        sourceLanguage,
        targetLanguage
      });
    }

    if (detectorSupported && self.LanguageDetector.availability) {
      detectorAvailability = await self.LanguageDetector.availability();
    }
  } catch (caught) {
    error = serializeError(caught);
  }

  return {
    translatorSupported,
    detectorSupported,
    pairAvailability,
    detectorAvailability,
    fallbackDictionary: getFallbackDictionaryStats(),
    error
  };
}

export async function translateTexts(texts, options = {}) {
  const targetLanguage = normalizeLanguageCode(options.targetLanguage) ?? "zh";
  const sourceLanguage =
    normalizeLanguageCode(options.sourceLanguage) ??
    (await detectLanguage(options.sample ?? texts.join("\n"), options.pageLanguage));

  if (!sourceLanguage) {
    return translateWithFallback(texts, "en", targetLanguage, [
      "Could not detect a supported source language."
    ]);
  }

  if (sourceLanguage === targetLanguage) {
    return {
      sourceLanguage,
      targetLanguage,
      engine: "none",
      translations: texts,
      warnings: []
    };
  }

  try {
    const translator = await getChromeTranslator(sourceLanguage, targetLanguage, {
      onProgress: options.onProgress
    });
    const translations = [];

    for (const text of texts) {
      translations.push(await translateOneWithChrome(translator, text));
    }

    return {
      sourceLanguage,
      targetLanguage,
      engine: "chrome-translator",
      translations,
      warnings: []
    };
  } catch (caught) {
    return translateWithFallback(texts, sourceLanguage, targetLanguage, [
      serializeError(caught).message
    ]);
  }
}

export async function prepareTranslator(sourceLanguage, targetLanguage, options = {}) {
  const source = normalizeLanguageCode(sourceLanguage);
  const target = normalizeLanguageCode(targetLanguage);

  if (!source || !target) {
    throw new Error("Choose a supported source and target language first.");
  }

  if (source === target) {
    return {
      sourceLanguage: source,
      targetLanguage: target,
      availability: "available",
      alreadySameLanguage: true
    };
  }

  if (!hasGlobalApi("Translator")) {
    throw new Error("Chrome Translator API is not available in this browser context.");
  }

  const availability = await self.Translator.availability({
    sourceLanguage: source,
    targetLanguage: target
  });

  const translator = await getChromeTranslator(source, target, options);
  return {
    sourceLanguage: source,
    targetLanguage: target,
    availability,
    translator
  };
}

export async function detectLanguage(text, pageLanguage) {
  const pageHint = normalizeLanguageCode(pageLanguage);
  const sample = normalizeSample(text);

  if (!sample) {
    return pageHint ?? "en";
  }

  if (hasGlobalApi("LanguageDetector")) {
    try {
      const detector = await getLanguageDetector();
      const results = await detector.detect(sample);
      const best = results.find((result) => {
        const code = normalizeLanguageCode(result.detectedLanguage);
        return code && result.confidence >= 0.26;
      });

      if (best) {
        return normalizeLanguageCode(best.detectedLanguage);
      }
    } catch {
      // Heuristic detection below keeps the extension useful when the detector is unavailable.
    }
  }

  return heuristicDetectLanguage(sample, pageHint);
}

export function heuristicDetectLanguage(text, pageLanguage) {
  const pageHint = normalizeLanguageCode(pageLanguage);
  const sample = normalizeSample(text);

  if (!sample) {
    return pageHint ?? "en";
  }

  if (/[ぁ-んァ-ヶ]/.test(sample)) {
    return "ja";
  }

  if (/[一-龯]/.test(sample)) {
    return "zh";
  }

  if (/[А-Яа-яЁё]/.test(sample)) {
    return "ru";
  }

  const lower = sample
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");

  const scores = {
    en: scoreWords(lower, ["the", "and", "you", "with", "from", "this", "that", "for", "not", "are"]),
    de: scoreWords(lower, ["der", "die", "das", "und", "ist", "nicht", "mit", "fur", "ein", "eine"]),
    fr: scoreWords(lower, ["le", "la", "les", "des", "une", "est", "pas", "pour", "avec", "vous"]),
    es: scoreWords(lower, ["el", "la", "los", "las", "una", "para", "con", "que", "por", "esta"])
  };

  const [bestLanguage, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (bestScore > 0) {
    return bestLanguage;
  }

  return pageHint ?? "en";
}

async function getChromeTranslator(sourceLanguage, targetLanguage, options = {}) {
  if (!hasGlobalApi("Translator")) {
    throw new Error("Chrome Translator API is not available in this browser context.");
  }

  const cacheKey = `${sourceLanguage}:${targetLanguage}`;
  if (translatorCache.has(cacheKey)) {
    return translatorCache.get(cacheKey);
  }

  const availability = await self.Translator.availability({
    sourceLanguage,
    targetLanguage
  });

  if (availability === "unavailable") {
    throw new Error(`Local language pack is unavailable for ${sourceLanguage} to ${targetLanguage}.`);
  }

  const translator = await self.Translator.create({
    sourceLanguage,
    targetLanguage,
    monitor(monitor) {
      if (typeof options.onProgress !== "function") {
        return;
      }

      monitor.addEventListener("downloadprogress", (event) => {
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          progress: event.total ? event.loaded / event.total : event.loaded
        });
      });
    }
  });

  if (translator.ready && typeof translator.ready.then === "function") {
    await translator.ready;
  }

  translatorCache.set(cacheKey, translator);
  return translator;
}

async function getLanguageDetector() {
  if (!languageDetectorPromise) {
    languageDetectorPromise = self.LanguageDetector.create();
  }

  return languageDetectorPromise;
}

async function translateOneWithChrome(translator, text) {
  if (!text || !text.trim()) {
    return text;
  }

  const translated = await translator.translate(text);
  return typeof translated === "string" ? translated : String(translated ?? text);
}

function translateWithFallback(texts, sourceLanguage, targetLanguage, warnings = []) {
  return {
    sourceLanguage,
    targetLanguage,
    engine: "local-glossary",
    translations: texts.map((text) => translateWithLocalGlossary(text, sourceLanguage, targetLanguage)),
    warnings
  };
}

function scoreWords(text, words) {
  return words.reduce((score, word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "g");
    const matches = text.match(pattern);
    return score + (matches ? matches.length : 0);
  }, 0);
}

function normalizeSample(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}

function hasGlobalApi(name) {
  const api = typeof self !== "undefined" ? self[name] : null;
  return Boolean(api && typeof api.availability === "function" && typeof api.create === "function");
}

function serializeError(error) {
  if (!error) {
    return { message: "Unknown translation error" };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    message: String(error)
  };
}

export function describeTranslationResult(result, locale = "zh") {
  const from = getLanguageLabel(result.sourceLanguage, locale);
  const to = getLanguageLabel(result.targetLanguage, locale);

  if (result.engine === "chrome-translator") {
    return `Chrome 本地翻译: ${from} -> ${to}`;
  }

  if (result.engine === "local-glossary") {
    return `离线词库兜底: ${from} -> ${to}`;
  }

  return `${from} -> ${to}`;
}

export { SUPPORTED_LANGUAGE_CODES };
