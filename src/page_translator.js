(() => {
  if (window.__trstonPageTranslatorLoaded) {
    return;
  }

  window.__trstonPageTranslatorLoaded = true;

  const SUPPORTED_LANGUAGE_CODES = [
    "ar",
    "bg",
    "bn",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "fi",
    "fr",
    "hi",
    "hr",
    "hu",
    "id",
    "it",
    "iw",
    "ja",
    "kn",
    "ko",
    "lt",
    "mr",
    "nl",
    "no",
    "pl",
    "pt",
    "ro",
    "ru",
    "sk",
    "sl",
    "sv",
    "ta",
    "te",
    "th",
    "tr",
    "uk",
    "vi",
    "zh",
    "zh-Hant"
  ];
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
  const CONCEPTS = [
    { en: "hello", de: "hallo", fr: "bonjour", ja: "こんにちは", zh: "你好", es: "hola", ru: "привет" },
    { en: "thank you", de: "danke", fr: "merci", ja: "ありがとうございます", zh: "谢谢", es: "gracias", ru: "спасибо" },
    { en: "settings", de: "einstellungen", fr: "parametres", ja: "設定", zh: "设置", es: "configuracion", ru: "настройки" },
    { en: "open", de: "offnen", fr: "ouvrir", ja: "開く", zh: "打开", es: "abrir", ru: "открыть" },
    { en: "save", de: "speichern", fr: "enregistrer", ja: "保存", zh: "保存", es: "guardar", ru: "сохранить" },
    { en: "cancel", de: "abbrechen", fr: "annuler", ja: "キャンセル", zh: "取消", es: "cancelar", ru: "отмена" },
    { en: "search", de: "suchen", fr: "rechercher", ja: "検索", zh: "搜索", es: "buscar", ru: "поиск" },
    { en: "home", de: "startseite", fr: "accueil", ja: "ホーム", zh: "首页", es: "inicio", ru: "главная" },
    { en: "login", de: "anmelden", fr: "connexion", ja: "ログイン", zh: "登录", es: "iniciar sesion", ru: "войти" },
    { en: "language", de: "sprache", fr: "langue", ja: "言語", zh: "语言", es: "idioma", ru: "язык" },
    { en: "translate", de: "ubersetzen", fr: "traduire", ja: "翻訳", zh: "翻译", es: "traducir", ru: "перевести" },
    { en: "translation", de: "ubersetzung", fr: "traduction", ja: "翻訳", zh: "翻译", es: "traduccion", ru: "перевод" },
    { en: "local", de: "lokal", fr: "local", ja: "ローカル", zh: "本地", es: "local", ru: "локальный" },
    { en: "page", de: "seite", fr: "page", ja: "ページ", zh: "页面", es: "pagina", ru: "страница" },
    { en: "text", de: "text", fr: "texte", ja: "テキスト", zh: "文本", es: "texto", ru: "текст" },
    { en: "error", de: "fehler", fr: "erreur", ja: "エラー", zh: "错误", es: "error", ru: "ошибка" },
    { en: "loading", de: "laden", fr: "chargement", ja: "読み込み中", zh: "加载中", es: "cargando", ru: "загрузка" },
    { en: "complete", de: "fertig", fr: "termine", ja: "完了", zh: "完成", es: "completo", ru: "готово" },
    { en: "help", de: "hilfe", fr: "aide", ja: "ヘルプ", zh: "帮助", es: "ayuda", ru: "помощь" },
    { en: "privacy", de: "datenschutz", fr: "confidentialite", ja: "プライバシー", zh: "隐私", es: "privacidad", ru: "конфиденциальность" },
    { en: "security", de: "sicherheit", fr: "securite", ja: "セキュリティ", zh: "安全", es: "seguridad", ru: "безопасность" },
    { en: "next", de: "weiter", fr: "suivant", ja: "次へ", zh: "下一步", es: "siguiente", ru: "далее" },
    { en: "back", de: "zuruck", fr: "retour", ja: "戻る", zh: "返回", es: "atras", ru: "назад" },
    { en: "continue", de: "fortfahren", fr: "continuer", ja: "続ける", zh: "继续", es: "continuar", ru: "продолжить" }
  ];
  const translatorCache = new Map();
  let detectorPromise = null;
  const exactLookup = buildExactLookup();

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    if (event.data.type === "TRSTON_DETECT_LANGUAGE_REQUEST") {
      const { id, text = "", pageLanguage = "" } = event.data;

      try {
        const language = await detectLanguage(text, pageLanguage);
        window.postMessage({
          type: "TRSTON_DETECT_LANGUAGE_RESPONSE",
          id,
          ok: true,
          language
        }, "*");
      } catch (error) {
        window.postMessage({
          type: "TRSTON_DETECT_LANGUAGE_RESPONSE",
          id,
          ok: false,
          error: serializeError(error)
        }, "*");
      }
      return;
    }

    if (event.data.type !== "TRSTON_TRANSLATE_REQUEST") {
      return;
    }

    const { id, texts = [], options = {} } = event.data;

    try {
      const result = await translateTexts(texts, {
        ...options,
        onProgress(progress) {
          window.postMessage({
            type: "TRSTON_TRANSLATE_PROGRESS",
            id,
            progress
          }, "*");
        }
      });

      window.postMessage({
        type: "TRSTON_TRANSLATE_RESPONSE",
        id,
        ok: true,
        result
      }, "*");
    } catch (error) {
      window.postMessage({
        type: "TRSTON_TRANSLATE_RESPONSE",
        id,
        ok: false,
        error: serializeError(error)
      }, "*");
    }
  });

  async function translateTexts(texts, options) {
    const targetLanguage = normalizeLanguageCode(options.targetLanguage) || "zh";
    const sourceLanguage =
      normalizeLanguageCode(options.sourceLanguage) ||
      (await detectLanguage(options.sample || texts.join("\n"), options.pageLanguage));

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
      const translator = await getChromeTranslator(sourceLanguage, targetLanguage, options);
      const translations = [];
      for (const text of texts) {
        translations.push(text?.trim() ? await translator.translate(text) : text);
      }

      return {
        sourceLanguage,
        targetLanguage,
        engine: "chrome-translator",
        translations,
        warnings: []
      };
    } catch (error) {
      return translateWithFallback(texts, sourceLanguage, targetLanguage, [
        serializeError(error).message
      ]);
    }
  }

  async function getChromeTranslator(sourceLanguage, targetLanguage, options = {}) {
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
      targetLanguage,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (downloadEvent) => {
          if (typeof options.onProgress === "function") {
            options.onProgress({
              loaded: downloadEvent.loaded,
              total: downloadEvent.total,
              progress: downloadEvent.total ? downloadEvent.loaded / downloadEvent.total : downloadEvent.loaded
            });
          }
        });
      }
    });

    if (translator.ready && typeof translator.ready.then === "function") {
      await translator.ready;
    }

    translatorCache.set(cacheKey, translator);
    return translator;
  }

  async function detectLanguage(text, pageLanguage) {
    const pageHint = normalizeLanguageCode(pageLanguage);
    const sample = normalizeSample(text);

    if (!sample) {
      return pageHint || "en";
    }

    if (hasApi("LanguageDetector")) {
      try {
        if (!detectorPromise) {
          detectorPromise = window.LanguageDetector.create();
        }
        const detector = await detectorPromise;
        const results = await detector.detect(sample);
        const best = results.find((result) => {
          const code = normalizeLanguageCode(result.detectedLanguage);
          return code && result.confidence >= 0.26;
        });

        if (best) {
          return normalizeLanguageCode(best.detectedLanguage);
        }
      } catch {
        // Fall back to lightweight local detection.
      }
    }

    return heuristicDetectLanguage(sample, pageHint);
  }

  function heuristicDetectLanguage(text, pageHint) {
    const sample = normalizeSample(text);

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
    return bestScore > 0 ? bestLanguage : pageHint || "en";
  }

  function translateWithFallback(texts, sourceLanguage, targetLanguage, warnings) {
    return {
      sourceLanguage,
      targetLanguage,
      engine: "local-glossary",
      translations: texts.map((text) => translateWithLocalGlossary(text, sourceLanguage, targetLanguage)),
      warnings
    };
  }

  function translateWithLocalGlossary(text, sourceLanguage, targetLanguage) {
    const source = normalizeLanguageCode(sourceLanguage);
    const target = normalizeLanguageCode(targetLanguage);
    if (!source || !target || source === target || !text) {
      return text;
    }

    return String(text).replace(/[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)?/gu, (word) => {
      const replacement = exactLookup.get(`${source}:${target}:${normalizeToken(word)}`);
      return replacement ? preserveCase(word, replacement) : word;
    });
  }

  function buildExactLookup() {
    const lookup = new Map();
    for (const concept of CONCEPTS) {
      for (const source of SUPPORTED_LANGUAGE_CODES) {
        for (const target of SUPPORTED_LANGUAGE_CODES) {
          if (source !== target && concept[source] && concept[target]) {
            lookup.set(`${source}:${target}:${normalizeToken(concept[source])}`, concept[target]);
          }
        }
      }
    }
    return lookup;
  }

  function normalizeLanguageCode(value) {
    if (!value) {
      return null;
    }

    const cleaned = String(value).trim().replace(/_/g, "-").toLowerCase();
    if (LANGUAGE_ALIASES.has(cleaned)) {
      return LANGUAGE_ALIASES.get(cleaned);
    }

    const canonical = SUPPORTED_LANGUAGE_CODES.find((code) => code.toLowerCase() === cleaned);
    if (canonical) {
      return canonical;
    }

    const base = cleaned.split("-")[0];
    return SUPPORTED_LANGUAGE_CODES.includes(base) ? base : null;
  }

  function normalizeSample(text) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 3000);
  }

  function normalizeToken(value) {
    return String(value)
      .trim()
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[’]/g, "'")
      .replace(/[。！？、，,.!?;:()[\]{}"“”]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function scoreWords(text, words) {
    return words.reduce((score, word) => {
      const matches = text.match(new RegExp(`\\b${word}\\b`, "g"));
      return score + (matches ? matches.length : 0);
    }, 0);
  }

  function preserveCase(original, translated) {
    if (!/[A-Za-z]/.test(original) || !/[A-Za-z]/.test(translated)) {
      return translated;
    }

    if (original === original.toUpperCase()) {
      return translated.toUpperCase();
    }

    if (/^[A-Z]/.test(original)) {
      return translated.charAt(0).toUpperCase() + translated.slice(1);
    }

    return translated;
  }

  function hasApi(name) {
    const api = window[name];
    return Boolean(api && typeof api.availability === "function" && typeof api.create === "function");
  }

  function serializeError(error) {
    if (error instanceof Error) {
      return { name: error.name, message: error.message };
    }

    return { message: String(error || "Unknown translation error") };
  }
})();
