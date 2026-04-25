(() => {
  if (window.__trstonContentScriptLoaded) {
    return;
  }

  window.__trstonContentScriptLoaded = true;

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
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE",
    "SVG",
    "CANVAS",
    "IFRAME",
    "OBJECT",
    "EMBED"
  ]);
  const DEFAULT_SETTINGS = {
    targetLanguage: "zh",
    translationEnabled: true,
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

  const originalTextByNode = new Map();
  const translatedTextByNode = new Map();
  const translatedNodes = new Set();
  const inFlightNodes = new Set();

  let originalDocumentTitle = null;
  let translatedDocumentTitle = null;
  let settings = null;
  let targetLanguage = DEFAULT_SETTINGS.targetLanguage;
  let sourceLanguage = null;
  let translationMode = "translated";
  let translationStarted = false;
  let initialPassCompleted = false;
  let isBatchRunning = false;
  let scheduledTimer = null;
  let mutationObserver = null;
  let activeToast = null;
  let overlayEnabled = true;
  let manualOverlayOpen = false;
  let overlayDismissed = false;
  let lastShortcutToggleAt = 0;
  let translatedCount = 0;
  let lastEngine = null;
  let lastError = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return false;
    }

    if (message.type === "TRSTON_SHOW_OVERLAY" || message.type === "TRSTON_TRANSLATE_PAGE") {
      handleManualOpen(message.settings)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => {
          lastError = error;
          showToast({
            state: "error",
            title: t("translationFailed", "Translation failed"),
            detail: error.message,
            force: true,
            persistent: true
          });
          sendStatus("error", "!");
          sendResponse({ ok: false, error: serializeError(error) });
        });
      return true;
    }

    if (message.type === "TRSTON_TOGGLE_TRANSLATION_SHORTCUT") {
      handleShortcutToggle(message.settings)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => {
          lastError = error;
          showToast({
            state: "error",
            title: t("translationFailed", "Translation failed"),
            detail: error.message,
            force: true,
            persistent: true
          });
          sendStatus("error", "!");
          sendResponse({ ok: false, error: serializeError(error) });
        });
      return true;
    }

    return false;
  });

  attachShortcutListener();
  bootstrapAutoTranslation();

  async function bootstrapAutoTranslation() {
    if (!isSupportedPage()) {
      return;
    }

    settings = normalizeSettings(await loadSettings());
    targetLanguage = settings.targetLanguage;
    overlayEnabled = settings.showOverlay !== false;

    if (!settings.translationEnabled || !settings.autoTranslate || !document.body || isCurrentSiteBlocked(settings.neverTranslateSites)) {
      return;
    }

    await delay(350);

    const detectedLanguage = await ensurePageLanguage();
    if (
      !detectedLanguage ||
      detectedLanguage === targetLanguage ||
      settings.neverTranslateLanguages.includes(detectedLanguage)
    ) {
      return;
    }

    await startTranslation({ manual: false, reason: "auto" });
  }

  async function handleManualOpen(incomingSettings) {
    settings = normalizeSettings(incomingSettings || (await loadSettings()));
    targetLanguage = settings.targetLanguage;
    overlayEnabled = true;
    manualOverlayOpen = true;

    if (!settings.translationEnabled) {
      if (translationStarted && translationMode === "translated") {
        showCurrentStatus({ manual: true });
        return { shown: true, disabled: true };
      }

      showTranslationDisabledToast({ manual: true, persistent: true });
      return { skipped: true, reason: "translation-disabled" };
    }

    const detectedLanguage = await ensurePageLanguage();
    if (detectedLanguage === targetLanguage && translatedCount === 0) {
      showToast({
        state: "done",
        title: t("toastPreferred", "This page already matches your preferred language"),
        detail: languagePairDetail(detectedLanguage, targetLanguage),
        manual: true,
        persistent: true,
        progress: 1
      });
      sendStatus("done", "OK");
      return { skipped: true, reason: "preferred-language" };
    }

    if (translationMode === "original") {
      showCurrentStatus({ manual: true });
      return { restored: true };
    }

    if (!translationStarted) {
      return startTranslation({ manual: true, reason: "manual" });
    }

    showCurrentStatus({ manual: true });
    scheduleTranslation({ delayMs: 0, manual: true });
    return { shown: true };
  }

  async function handleShortcutToggle(incomingSettings) {
    const now = Date.now();
    if (now - lastShortcutToggleAt < 350) {
      return { skipped: true, reason: "shortcut-debounce" };
    }
    lastShortcutToggleAt = now;

    settings = normalizeSettings(incomingSettings || (await loadSettings()));
    settings = {
      ...settings,
      showOverlay: true
    };
    targetLanguage = settings.targetLanguage;
    overlayEnabled = true;
    manualOverlayOpen = false;
    overlayDismissed = false;

    if (translationStarted && translationMode === "translated") {
      restoreOriginalText({ temporary: true });
      return { mode: "original" };
    }

    if (!settings.translationEnabled) {
      showTranslationDisabledToast({ force: true, autoCloseMs: 5000 });
      return { skipped: true, reason: "translation-disabled" };
    }

    if (translationMode === "original") {
      toggleTranslationMode({ temporary: true });
      return { mode: "translated" };
    }

    await startTranslation({ manual: false });
    return { mode: "translated" };
  }

  async function startTranslation({ manual = false } = {}) {
    if (!settings) {
      settings = normalizeSettings(await loadSettings());
    }

    targetLanguage = settings.targetLanguage;
    overlayEnabled = settings.showOverlay !== false || manual;
    if (!settings.translationEnabled) {
      showTranslationDisabledToast({ manual, force: manual, autoCloseMs: 5000 });
      return { skipped: true, reason: "translation-disabled" };
    }

    translationMode = "translated";
    translationStarted = true;
    lastError = null;
    attachStreamListeners();
    updateToggleButton();

    const detectedLanguage = await ensurePageLanguage();
    if (detectedLanguage === targetLanguage) {
      showToast({
        state: "done",
        title: t("toastPreferred", "This page already matches your preferred language"),
        detail: languagePairDetail(detectedLanguage, targetLanguage),
        manual,
        progress: 1,
        autoCloseMs: 5000
      });
      sendStatus("done", "OK");
      return { skipped: true, reason: "preferred-language" };
    }

    if (settings.translateTitle !== false && document.title.trim()) {
      translateTitle().catch((error) => {
        console.warn("Trston title translation failed.", error);
      });
    }

    showToast({
      state: "working",
      title: t("toastTranslating", "Translating nearby text"),
      detail: languagePairDetail(sourceLanguage, targetLanguage),
      manual,
      progress: 0
    });

    await runTranslationPass({ manual, initial: true });
    return {
      translated: translatedCount,
      sourceLanguage,
      targetLanguage,
      engine: lastEngine
    };
  }

  async function runTranslationPass({ manual = false, initial = false } = {}) {
    if (isBatchRunning || translationMode !== "translated") {
      return;
    }

    isBatchRunning = true;

    try {
      const nodes = collectTextNodes({
        limit: settings.streamTranslation ? settings.maxNodes : settings.maxNodes,
        viewportOnly: settings.streamTranslation !== false
      });

      if (nodes.length === 0) {
        if (initial && translatedCount === 0) {
          showToast({
            state: "done",
            title: t("toastNoText", "No translatable text found"),
            detail: "",
            manual,
            autoCloseMs: 5000
          });
        } else if (initial || manualOverlayOpen) {
          showCompletionToast({ manual, autoCloseMs: 5000 });
        }
        return;
      }

      for (let index = 0; index < nodes.length; index += settings.batchSize) {
        const batchNodes = nodes.slice(index, index + settings.batchSize);
        batchNodes.forEach((node) => inFlightNodes.add(node));

        try {
          const response = await requestPageTranslation(
            batchNodes.map((node) => getOriginalText(node)),
            {
              targetLanguage,
              sourceLanguage,
              pageLanguage: getPageLanguageHint(),
              sample: buildSampleFromNodes(batchNodes)
            }
          );

          if (!response.ok) {
            throw new Error(response.error?.message || t("translationFailed", "Translation failed"));
          }

          const result = response.result;
          sourceLanguage = result.sourceLanguage || sourceLanguage;
          lastEngine = result.engine;

          if (sourceLanguage === targetLanguage || result.engine === "none") {
            showToast({
              state: "done",
              title: t("toastPreferred", "This page already matches your preferred language"),
              detail: languagePairDetail(sourceLanguage, targetLanguage),
              manual,
              progress: 1,
              autoCloseMs: 5000
            });
            sendStatus("done", "OK");
            return;
          }

          result.translations.forEach((translation, offset) => {
            const node = batchNodes[offset];
            if (!node || !node.isConnected || translationMode !== "translated") {
              return;
            }

            applyTranslation(node, translation);
          });

          if (manualOverlayOpen || !initialPassCompleted) {
            showToast({
              state: "working",
              title: t("toastTranslating", "Translating nearby text"),
              detail: t("toastDoneDetail", "$COUNT$ passages translated.", [String(translatedCount)]),
              progress: Math.min(0.95, translatedCount / Math.max(translatedCount + 8, 1)),
              manual
            });
          }

          await waitForPaint();
        } finally {
          batchNodes.forEach((node) => inFlightNodes.delete(node));
        }
      }

      if (initial) {
        initialPassCompleted = true;
        showCompletionToast({ manual, autoCloseMs: 5000 });
      } else if (manualOverlayOpen) {
        showCurrentStatus({ manual: true });
      }

      sendStatus("done", "OK");
    } catch (error) {
      lastError = error;
      showToast({
        state: "error",
        title: t("translationFailed", "Translation failed"),
        detail: error.message,
        force: true,
        persistent: true
      });
      sendStatus("error", "!");
    } finally {
      isBatchRunning = false;
    }
  }

  function showCompletionToast({ manual = false, autoCloseMs = 5000 } = {}) {
    const usedFallback = lastEngine === "local-glossary";
    showToast({
      state: usedFallback ? "warning" : "done",
      title: usedFallback ? t("offlineGlossary", "Offline glossary") : t("toastDone", "Trston is ready"),
      detail: usedFallback
        ? t("toastFallbackDetail", "Chrome local translation is unavailable, so Trston used the packaged offline glossary.")
        : t("toastDoneDetail", "$COUNT$ passages translated.", [String(translatedCount)]),
      progress: 1,
      manual,
      autoCloseMs
    });
  }

  function showTranslationDisabledToast({ manual = false, persistent = false, force = false, autoCloseMs = 5000 } = {}) {
    showToast({
      state: "done",
      title: t("toastDisabled", "Trston is paused"),
      detail: t("toastDisabledDetail", "Enable translation in settings to translate pages."),
      progress: 0,
      manual,
      persistent,
      force,
      autoCloseMs
    });
    sendStatus("idle", "");
  }

  function showCurrentStatus({ manual = false } = {}) {
    const title =
      translationMode === "original"
        ? t("toastRestored", "Original text restored")
        : lastError
          ? t("translationFailed", "Translation failed")
          : t("toastDone", "Trston is ready");
    const detail =
      translationMode === "original"
        ? t("toastRestoreDetail", "Translated text on this page has been restored.")
        : lastError?.message || t("toastDoneDetail", "$COUNT$ passages translated.", [String(translatedCount)]);

    showToast({
      state: lastError ? "error" : "done",
      title,
      detail,
      progress: translationMode === "translated" ? 1 : 0,
      manual,
      persistent: manual
    });
  }

  async function translateTitle() {
    const originalTitle = originalDocumentTitle ?? document.title;
    if (originalDocumentTitle === null) {
      originalDocumentTitle = originalTitle;
    }

    if (translatedDocumentTitle && translationMode === "translated") {
      document.title = translatedDocumentTitle;
      return;
    }

    const response = await requestPageTranslation([originalTitle], {
      targetLanguage,
      sourceLanguage,
      pageLanguage: getPageLanguageHint(),
      sample: originalTitle
    });

    if (response.ok && response.result?.translations?.[0]) {
      translatedDocumentTitle = response.result.translations[0];
      if (translationMode === "translated") {
        document.title = translatedDocumentTitle;
      }
    }
  }

  function collectTextNodes({ limit = 900, viewportOnly = true } = {}) {
    const nodes = [];
    const root = document.body;
    if (!root) {
      return nodes;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (nodes.length >= limit) {
          return NodeFilter.FILTER_REJECT;
        }

        if (translatedNodes.has(node) || inFlightNodes.has(node) || !isTranslatableText(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent) || !isElementVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (viewportOnly && !isElementNearViewport(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode() && nodes.length < limit) {
      nodes.push(walker.currentNode);
    }

    return nodes;
  }

  function collectSampleNodes(limit = 80) {
    const nodes = [];
    const root = document.body;
    if (!root) {
      return nodes;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (nodes.length >= limit) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (
          !isTranslatableText(node.nodeValue) ||
          !parent ||
          shouldSkipElement(parent) ||
          !isElementVisible(parent)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode() && nodes.length < limit) {
      nodes.push(walker.currentNode);
    }

    return nodes;
  }

  function shouldSkipElement(element) {
    if (SKIP_TAGS.has(element.tagName)) {
      return true;
    }

    if (element.closest("#trston-overlay-host")) {
      return true;
    }

    if (element.closest("[contenteditable='true']")) {
      return true;
    }

    return Boolean(element.closest("script, style, noscript, textarea, input, select, code, pre, svg"));
  }

  function isElementVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function isElementNearViewport(element) {
    const rect = element.getBoundingClientRect();
    const margin = window.innerHeight * Number(settings?.viewportMarginScreens || 1.35);
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }

  function isTranslatableText(text) {
    const trimmed = String(text ?? "").trim();
    if (trimmed.length < 2) {
      return false;
    }

    if (/^[\d\s.,:;!?()[\]{}'"“”‘’\-+*/=<>|\\]+$/.test(trimmed)) {
      return false;
    }

    return /[\p{L}\p{Script=Han}]/u.test(trimmed);
  }

  function getOriginalText(node) {
    if (!originalTextByNode.has(node)) {
      originalTextByNode.set(node, node.nodeValue);
    }

    return originalTextByNode.get(node);
  }

  function applyTranslation(node, translation) {
    const original = getOriginalText(node);
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    const translated = `${leading}${String(translation ?? original).trim()}${trailing}`;
    node.nodeValue = translated;
    translatedTextByNode.set(node, translated);
    translatedNodes.add(node);
    translatedCount = translatedNodes.size;
    animateTranslatedNode(node);
  }

  function toggleTranslationMode({ temporary = false } = {}) {
    if (translationMode === "translated") {
      restoreOriginalText({ temporary });
      return;
    }

    if (!settings?.translationEnabled) {
      showTranslationDisabledToast({ manual: !temporary, force: temporary, persistent: !temporary, autoCloseMs: 5000 });
      return;
    }

    translationMode = "translated";
    lastError = null;
    for (const [node, translatedText] of translatedTextByNode.entries()) {
      if (node.isConnected) {
        node.nodeValue = translatedText;
        translatedNodes.add(node);
      }
    }
    translatedCount = translatedNodes.size;

    if (translatedDocumentTitle) {
      document.title = translatedDocumentTitle;
    }

    updateToggleButton();
    showToast({
      state: "working",
      title: t("toastTranslating", "Translating nearby text"),
      detail: languagePairDetail(sourceLanguage, targetLanguage),
      manual: !temporary,
      force: temporary,
      persistent: !temporary,
      autoCloseMs: 5000
    });
    startTranslation({ manual: !temporary }).catch((error) => {
      lastError = error;
      showToast({
        state: "error",
        title: t("translationFailed", "Translation failed"),
        detail: error.message,
        force: true,
        persistent: true
      });
    });
  }

  function restoreOriginalText({ temporary = false } = {}) {
    translationMode = "original";

    for (const [node, text] of originalTextByNode.entries()) {
      if (node.isConnected) {
        node.nodeValue = text;
      }
    }

    translatedNodes.clear();

    if (originalDocumentTitle !== null) {
      document.title = originalDocumentTitle;
    }

    updateToggleButton();
    showToast({
      state: "done",
      title: t("toastRestored", "Original text restored"),
      detail: t("toastRestoreDetail", "Translated text on this page has been restored."),
      progress: 0,
      manual: !temporary,
      force: temporary,
      persistent: !temporary,
      autoCloseMs: 5000
    });
    sendStatus("idle", "");
  }

  function showToast(options) {
    if (!overlayEnabled && !options.force && !options.manual) {
      return null;
    }

    if (options.manual) {
      manualOverlayOpen = true;
      overlayDismissed = false;
    }

    if (overlayDismissed && !options.force && !options.manual) {
      return null;
    }

    if (!activeToast) {
      activeToast = createToast();
    }

    const { root, title, detail, progress, host } = activeToast;
    setToastVisible(host, true);
    host.dataset.state = options.state || "idle";
    title.textContent = options.title || "Trston";
    detail.textContent = options.detail || "";
    progress.style.transform = `scaleX(${Math.max(0, Math.min(1, options.progress ?? 0))})`;
    updateToggleButton();

    window.clearTimeout(activeToast.hideTimer);
    const shouldAutoClose = !manualOverlayOpen && !options.persistent && options.state !== "working";
    if (shouldAutoClose) {
      activeToast.hideTimer = window.setTimeout(() => {
        setToastVisible(host, false);
      }, options.autoCloseMs ?? 5000);
    }

    return root;
  }

  function createToast() {
    const host = document.createElement("div");
    host.id = "trston-overlay-host";
    styleToastHost(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          box-sizing: border-box;
          position: fixed;
          top: 18px;
          right: 18px;
          z-index: 2147483647;
          display: block;
          width: min(288px, calc(100vw - 24px));
          max-width: calc(100vw - 24px);
          pointer-events: auto;
        }
        :host([hidden]) { display: none !important; }
        * { box-sizing: border-box; }
        .toast {
          width: 100%;
          border: 1px solid rgba(0, 0, 0, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.88);
          color: #0a0a0a;
          box-shadow: 0 16px 38px rgba(0, 0, 0, 0.16);
          font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow: hidden;
          backdrop-filter: blur(18px) saturate(1.15);
          animation: trston-toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .content { padding: 11px; }
        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .mark {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 10px;
          background: #0a0a0a;
          color: #fff;
          font-weight: 800;
          letter-spacing: 0;
          transition: transform 180ms ease;
        }
        .toast:hover .mark { transform: rotate(-3deg) scale(1.03); }
        .title {
          margin: 0;
          font-weight: 760;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0;
        }
        .detail {
          margin: 9px 0 0;
          color: #4a4a4a;
          word-break: break-word;
        }
        .actions {
          display: flex;
          gap: 7px;
          margin-top: 11px;
        }
        button {
          border: 1px solid rgba(0, 0, 0, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.74);
          color: #0a0a0a;
          height: 32px;
          padding: 0 10px;
          font: inherit;
          font-weight: 720;
          cursor: pointer;
          transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, color 140ms ease;
        }
        button:hover { background: #fff; }
        button:active { transform: scale(0.97); }
        button.primary {
          background: #0a0a0a;
          color: #fff;
          border-color: #0a0a0a;
        }
        button.primary:hover { background: #2a2a2a; }
        .bar {
          height: 3px;
          width: 100%;
          background: rgba(0, 0, 0, 0.08);
          transform-origin: left center;
        }
        .bar > span {
          display: block;
          position: relative;
          height: 100%;
          width: 100%;
          transform: scaleX(0);
          transform-origin: left center;
          background: #0a0a0a;
          transition: transform 160ms ease;
        }
        :host([data-state="working"]) .bar > span::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 44%;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.36);
          filter: blur(2px);
          animation: trston-progress-sheen 980ms ease-in-out infinite;
        }
        :host([data-state="error"]) .toast {
          border-color: rgba(0, 0, 0, 0.38);
        }
        @media (prefers-color-scheme: dark) {
          .toast {
            border-color: rgba(255, 255, 255, 0.16);
            background: rgba(18, 18, 18, 0.84);
            color: #f7f7f7;
            box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
          }
          .mark { background: #f7f7f7; color: #0a0a0a; }
          .detail { color: #c7c7c7; }
          button {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.18);
            color: #f7f7f7;
          }
          button:hover { background: rgba(255, 255, 255, 0.14); }
          button.primary {
            background: #f7f7f7;
            color: #0a0a0a;
            border-color: #f7f7f7;
          }
          button.primary:hover { background: #e5e5e5; }
          .bar { background: rgba(255, 255, 255, 0.12); }
          .bar > span { background: #f7f7f7; }
          :host([data-state="working"]) .bar > span::after {
            background: rgba(0, 0, 0, 0.22);
          }
        }
        @keyframes trston-toast-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes trston-progress-sheen {
          from { transform: translateX(-120%); }
          to { transform: translateX(240%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast,
          .bar > span,
          .bar > span::after,
          button,
          .mark {
            animation: none !important;
            transition: none !important;
          }
        }
      </style>
      <section class="toast" role="status" aria-live="polite">
        <div class="content">
          <div class="top">
            <div class="brand">
              <span class="mark">T</span>
              <p class="title"></p>
            </div>
          </div>
          <p class="detail"></p>
          <div class="actions">
            <button class="primary" id="toggle" type="button"></button>
            <button id="dismiss" type="button"></button>
          </div>
        </div>
        <div class="bar" aria-hidden="true"><span></span></div>
      </section>
    `;

    document.documentElement.append(host);
    root.getElementById("toggle").addEventListener("click", toggleTranslationMode);
    root.getElementById("dismiss").addEventListener("click", () => {
      manualOverlayOpen = false;
      overlayDismissed = true;
      setToastVisible(host, false);
    });
    root.getElementById("dismiss").textContent = t("buttonClose", "Close");

    return {
      host,
      root,
      title: root.querySelector(".title"),
      detail: root.querySelector(".detail"),
      progress: root.querySelector(".bar > span"),
      toggle: root.getElementById("toggle"),
      hideTimer: null
    };
  }

  function updateToggleButton() {
    if (!activeToast?.toggle) {
      return;
    }

    activeToast.toggle.textContent =
      translationMode === "translated" ? t("buttonRestore", "Restore") : t("buttonTranslate", "Translate");
  }

  function animateTranslatedNode(node) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return;
    }

    const element = node.parentElement;
    if (!element || shouldSkipElement(element)) {
      return;
    }

    ensurePageAnimationStyles();
    element.classList.remove("trston-translated-flash");
    window.requestAnimationFrame(() => {
      element.classList.add("trston-translated-flash");
      window.setTimeout(() => {
        element.classList.remove("trston-translated-flash");
      }, 560);
    });
  }

  function ensurePageAnimationStyles() {
    if (document.getElementById("trston-page-animation-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "trston-page-animation-style";
    style.textContent = `
      @keyframes trstonTranslatedFlash {
        0% { opacity: 0.58; filter: blur(1.5px); }
        55% { opacity: 1; filter: blur(0); }
        100% { opacity: 1; filter: none; }
      }
      .trston-translated-flash {
        animation: trstonTranslatedFlash 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      @media (prefers-reduced-motion: reduce) {
        .trston-translated-flash {
          animation: none !important;
        }
      }
    `;
    document.documentElement.append(style);
  }

  function attachStreamListeners() {
    if (!settings?.streamTranslation) {
      return;
    }

    if (!window.__trstonScrollListenerAttached) {
      window.__trstonScrollListenerAttached = true;
      window.addEventListener("scroll", () => scheduleTranslation({ delayMs: 120 }), { passive: true });
      window.addEventListener("resize", () => scheduleTranslation({ delayMs: 180 }), { passive: true });
    }

    if (!mutationObserver && document.body) {
      mutationObserver = new MutationObserver(() => scheduleTranslation({ delayMs: 220 }));
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  function attachShortcutListener() {
    if (window.__trstonShortcutListenerAttached) {
      return;
    }

    window.__trstonShortcutListenerAttached = true;
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.code !== "KeyJ") {
        return;
      }

      const primaryCombo = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      const optionCombo = event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey;

      if (!primaryCombo && !optionCombo) {
        return;
      }

      if (optionCombo && isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      handleShortcutToggle().catch((error) => {
        lastError = error;
        showToast({
          state: "error",
          title: t("translationFailed", "Translation failed"),
          detail: error.message,
          force: true,
          persistent: true
        });
      });
    }, true);
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function scheduleTranslation({ delayMs = 120, manual = false } = {}) {
    if (translationMode !== "translated" || !translationStarted) {
      return;
    }

    window.clearTimeout(scheduledTimer);
    scheduledTimer = window.setTimeout(() => {
      runTranslationPass({ manual, initial: false });
    }, delayMs);
  }

  async function ensurePageLanguage() {
    if (sourceLanguage) {
      return sourceLanguage;
    }

    const pageHint = normalizeLanguageCode(getPageLanguageHint());
    const sample = buildSampleFromNodes(collectSampleNodes(80));
    if (!sample && pageHint) {
      sourceLanguage = pageHint;
      return sourceLanguage;
    }

    try {
      sourceLanguage = await requestPageLanguage(sample, pageHint);
    } catch {
      sourceLanguage = pageHint || null;
    }

    return sourceLanguage;
  }

  function requestPageLanguage(text, pageLanguage) {
    return sendRuntimeMessage({
      type: "TRSTON_PAGE_DETECT_LANGUAGE",
      text,
      pageLanguage
    }).then((response) => {
      if (response?.ok) {
        return normalizeLanguageCode(response.language);
      }

      throw new Error(response?.error?.message || t("detectFailed", "Check failed"));
    });
  }

  function requestPageTranslation(texts, options) {
    return sendRuntimeMessage({
      type: "TRSTON_PAGE_TRANSLATE",
      texts,
      options
    });
  }

  function styleToastHost(host) {
    const declarations = {
      position: "fixed",
      top: "18px",
      right: "18px",
      zIndex: "2147483647",
      width: "min(288px, calc(100vw - 24px))",
      maxWidth: "calc(100vw - 24px)",
      height: "auto",
      margin: "0",
      padding: "0",
      border: "0",
      background: "transparent",
      pointerEvents: "auto"
    };

    for (const [property, value] of Object.entries(declarations)) {
      host.style.setProperty(toKebabCase(property), value, "important");
    }
  }

  function setToastVisible(host, isVisible) {
    host.hidden = !isVisible;
    host.style.setProperty("display", isVisible ? "block" : "none", "important");
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "TRSTON_GET_SETTINGS" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          resolve(DEFAULT_SETTINGS);
          return;
        }

        resolve(response.settings);
      });
    });
  }

  function sendStatus(state, text) {
    chrome.runtime.sendMessage({ type: "TRSTON_STATUS", state, text }, () => {
      chrome.runtime.lastError;
    });
  }

  function getPageLanguageHint() {
    return (
      document.documentElement.lang ||
      document.querySelector("meta[http-equiv='content-language']")?.content ||
      document.querySelector("meta[name='language']")?.content ||
      ""
    );
  }

  function buildSampleFromNodes(nodes) {
    return nodes
      .map((node) => String(node.nodeValue || "").trim())
      .filter(Boolean)
      .slice(0, 60)
      .join("\n")
      .slice(0, 3000);
  }

  function languagePairDetail(source, target) {
    return `${source || "auto"} -> ${target || targetLanguage}`;
  }

  function normalizeSettings(value = {}) {
    const batchSize = clampNumber(value.batchSize, 4, 40, DEFAULT_SETTINGS.batchSize);
    return {
      ...DEFAULT_SETTINGS,
      ...value,
      targetLanguage: normalizeLanguageCode(value.targetLanguage) || DEFAULT_SETTINGS.targetLanguage,
      translationEnabled: value.translationEnabled !== false,
      showOverlay: value.showOverlay !== false,
      autoTranslate: value.autoTranslate !== false,
      streamTranslation: value.streamTranslation !== false,
      translateTitle: value.translateTitle !== false,
      neverTranslateLanguages: normalizeLanguageList(value.neverTranslateLanguages),
      neverTranslateSites: normalizeSiteList(value.neverTranslateSites),
      maxNodes: clampNumber(value.maxNodes, 80, 5000, DEFAULT_SETTINGS.maxNodes),
      batchSize,
      viewportMarginScreens: clampNumber(
        Number(value.viewportMarginScreens) * 100,
        50,
        300,
        DEFAULT_SETTINGS.viewportMarginScreens * 100
      ) / 100
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

  function normalizeSitePattern(value) {
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

  function isCurrentSiteBlocked(sitePatterns) {
    const hostname = normalizeSiteHost(window.location.hostname);
    const pathname = normalizeSitePath(window.location.pathname) || "/";
    return sitePatterns.some((site) => sitePatternMatchesCurrentLocation(site, hostname, pathname));
  }

  function sitePatternMatchesCurrentLocation(pattern, hostname, pathname) {
    const normalizedPattern = normalizeSitePattern(pattern);
    if (!normalizedPattern) {
      return false;
    }

    const { host: patternHost, path: patternPath } = splitSitePattern(normalizedPattern);
    const hostMatches = hostname === patternHost || hostname.endsWith(`.${patternHost}`);
    if (!hostMatches) {
      return false;
    }

    if (!patternPath) {
      return true;
    }

    return pathname === patternPath || pathname.startsWith(`${patternPath}/`);
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

  function t(key, fallback, substitutions) {
    if (chrome.i18n?.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    }

    if (!Array.isArray(substitutions)) {
      return fallback;
    }

    return substitutions.reduce((text, value, index) => {
      return text.replace(`$${index + 1}`, value).replace(/\$[A-Z_]+\$/u, value);
    }, fallback);
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  function isSupportedPage() {
    return /^https?:$/i.test(window.location.protocol);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || t("toastNoResponse", "Chrome local translation did not respond.")));
          return;
        }

        resolve(response);
      });
    });
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function waitForPaint() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  function toKebabCase(value) {
    return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  function serializeError(error) {
    if (error instanceof Error) {
      return { name: error.name, message: error.message };
    }

    return { message: String(error ?? "Unknown error") };
  }
})();
