(() => {
  const BRIDGE_VERSION = "trston-page-translator-v2";
  const translatorCache = new Map();
  let detectorPromise = null;

  async function translateTexts(payload = {}) {
    const sourceLanguage = payload.sourceLanguage;
    const targetLanguage = payload.targetLanguage;
    const texts = Array.isArray(payload.texts) ? payload.texts : [];

    if (!sourceLanguage || !targetLanguage) {
      throw new Error("Choose a supported source and target language first.");
    }

    if (sourceLanguage === targetLanguage) {
      return texts;
    }

    const translator = await getChromeTranslator(sourceLanguage, targetLanguage);
    const translations = [];
    for (const text of texts) {
      translations.push(text?.trim() ? await translator.translate(text) : text);
    }

    return translations;
  }

  async function detectLanguage(payload = {}) {
    const sample = normalizeSample(payload.text);
    if (!sample || !hasApi("LanguageDetector")) {
      return null;
    }

    if (!detectorPromise) {
      detectorPromise = window.LanguageDetector.create();
    }

    const detector = await detectorPromise;
    const results = await detector.detect(sample);
    const best = results.find((result) => result?.detectedLanguage && result.confidence >= 0.26);
    return best?.detectedLanguage || null;
  }

  async function getChromeTranslator(sourceLanguage, targetLanguage) {
    if (!hasApi("Translator")) {
      throw new Error("Chrome Translator API is not available in this page context.");
    }

    const cacheKey = `${sourceLanguage}:${targetLanguage}`;
    if (translatorCache.has(cacheKey)) {
      return translatorCache.get(cacheKey);
    }

    const availability = await window.Translator.availability({
      sourceLanguage,
      targetLanguage
    });

    if (availability === "unavailable") {
      throw new Error(`Local language pack is unavailable for ${sourceLanguage} to ${targetLanguage}.`);
    }

    const translator = await window.Translator.create({
      sourceLanguage,
      targetLanguage
    });

    if (translator.ready && typeof translator.ready.then === "function") {
      await translator.ready;
    }

    translatorCache.set(cacheKey, translator);
    return translator;
  }

  function normalizeSample(text) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 3000);
  }

  function hasApi(name) {
    const api = window[name];
    return Boolean(api && typeof api.availability === "function" && typeof api.create === "function");
  }

  const bridge = Object.freeze({
    version: BRIDGE_VERSION,
    detectLanguage,
    translateTexts
  });

  Object.defineProperty(window, "__trstonPageTranslator", {
    value: bridge,
    configurable: true,
    enumerable: false,
    writable: false
  });
})();
