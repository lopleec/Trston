import {
  DEFAULT_SETTINGS,
  coerceSettings,
  normalizeLanguageCode
} from "./languages.js";
import {
  detectLanguage as detectWithExtensionFallback,
  translateTexts as translateWithExtensionFallback
} from "./translation_engine.js";

const MENU_OPEN_OPTIONS = "trston-open-options";
const LOCAL_ONLY_SETTING_KEYS = new Set(["neverTranslateSites"]);
const BADGE_COLORS = {
  working: "#111111",
  done: "#2f2f2f",
  error: "#000000",
  idle: "#6b6b6b"
};

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings();
  setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

chrome.action.onClicked.addListener(showOverlayOnTab);

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-translation") {
    return;
  }

  const targetTab = tab?.id ? tab : await getActiveTab();
  if (targetTab) {
    await toggleTranslationOnTab(targetTab);
  }
});

async function showOverlayOnTab(tab) {
  if (!tab.id) {
    return;
  }

  await setBadge(tab.id, "working", "...");

  try {
    await ensureTabScripts(tab.id);
    const settings = await getSettings();
    await chrome.tabs.sendMessage(tab.id, {
      type: "TRSTON_SHOW_OVERLAY",
      settings,
      manual: true
    });
  } catch (error) {
    await setBadge(tab.id, "error", "!");
    console.warn("Trston could not translate this tab.", error);
  }
}

async function toggleTranslationOnTab(tab) {
  if (!tab.id) {
    return;
  }

  await setBadge(tab.id, "working", "...");

  try {
    await ensureTabScripts(tab.id);
    const settings = await getSettings();
    await chrome.tabs.sendMessage(tab.id, {
      type: "TRSTON_TOGGLE_TRANSLATION_SHORTCUT",
      settings
    });
  } catch (error) {
    await setBadge(tab.id, "error", "!");
    console.warn("Trston could not toggle this tab.", error);
  }
}

async function ensureTabScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content_script.js"]
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab ?? null;
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (String(info.menuItemId).startsWith(MENU_OPEN_OPTIONS)) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "TRSTON_GET_SETTINGS") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: serializeError(error) }));
    return true;
  }

  if (message.type === "TRSTON_SAVE_SETTINGS") {
    saveSettings(message.settings ?? {})
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: serializeError(error) }));
    return true;
  }

  if (message.type === "TRSTON_PAGE_DETECT_LANGUAGE") {
    detectPageLanguage(sender, message)
      .then((language) => sendResponse({ ok: true, language }))
      .catch((error) => sendResponse({ ok: false, error: serializeError(error) }));
    return true;
  }

  if (message.type === "TRSTON_PAGE_TRANSLATE") {
    translatePageTexts(sender, message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: serializeError(error) }));
    return true;
  }

  if (message.type === "TRSTON_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "TRSTON_STATUS" && sender.tab?.id) {
    setBadge(sender.tab.id, message.state, message.text);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function ensureDefaultSettings() {
  await persistSettings(await getSettings());
}

async function getSettings() {
  const synced = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const local = await chrome.storage.local.get({ neverTranslateSites: null });
  const migratedSites = Array.isArray(local.neverTranslateSites)
    ? local.neverTranslateSites
    : synced.neverTranslateSites;
  const settings = coerceSettings({
    ...synced,
    neverTranslateSites: migratedSites
  });

  if (Array.isArray(synced.neverTranslateSites) && synced.neverTranslateSites.length > 0) {
    await chrome.storage.local.set({ neverTranslateSites: settings.neverTranslateSites });
    await chrome.storage.sync.remove("neverTranslateSites");
  }

  return settings;
}

async function saveSettings(partialSettings) {
  const settings = coerceSettings({
    ...(await getSettings()),
    ...partialSettings
  });

  await persistSettings(settings);
  return settings;
}

async function persistSettings(settings) {
  const syncSettings = {};
  const localSettings = {};

  for (const [key, value] of Object.entries(settings)) {
    if (LOCAL_ONLY_SETTING_KEYS.has(key)) {
      localSettings[key] = value;
    } else {
      syncSettings[key] = value;
    }
  }

  await Promise.all([
    chrome.storage.sync.set(syncSettings),
    chrome.storage.local.set(localSettings),
    chrome.storage.sync.remove([...LOCAL_ONLY_SETTING_KEYS])
  ]);
}

async function detectPageLanguage(sender, message) {
  const text = message.text || "";
  const pageLanguage = message.pageLanguage || "";

  try {
    const language = normalizeLanguageCode(
      await runPageTranslator(sender, "detectLanguage", { text })
    );
    if (language) {
      return language;
    }
  } catch {
    // Extension-side detection keeps the feature working if MAIN-world APIs fail.
  }

  return detectWithExtensionFallback(text, pageLanguage);
}

async function translatePageTexts(sender, message) {
  const texts = Array.isArray(message.texts) ? message.texts : [];
  const options = message.options || {};
  const targetLanguage = normalizeLanguageCode(options.targetLanguage) || DEFAULT_SETTINGS.targetLanguage;
  const sourceLanguage =
    normalizeLanguageCode(options.sourceLanguage) ||
    (await detectPageLanguage(sender, {
      text: options.sample || texts.join("\n"),
      pageLanguage: options.pageLanguage
    }));

  if (!sourceLanguage) {
    return translateWithExtensionFallback(texts, {
      ...options,
      sourceLanguage: "en",
      targetLanguage
    });
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
    const translations = await runPageTranslator(sender, "translateTexts", {
      texts,
      sourceLanguage,
      targetLanguage
    });

    return {
      sourceLanguage,
      targetLanguage,
      engine: "chrome-translator",
      translations,
      warnings: []
    };
  } catch (error) {
    const result = await translateWithExtensionFallback(texts, {
      ...options,
      sourceLanguage,
      targetLanguage
    });
    return {
      ...result,
      warnings: [
        ...(result.warnings || []),
        serializeError(error).message
      ].filter(Boolean)
    };
  }
}

async function runPageTranslator(sender, method, payload) {
  if (!sender.tab?.id) {
    throw new Error("No active tab is available for page translation.");
  }

  const target = { tabId: sender.tab.id };
  if (Number.isInteger(sender.frameId) && sender.frameId >= 0) {
    target.frameIds = [sender.frameId];
  }

  await chrome.scripting.executeScript({
    target,
    files: ["src/page_translator.js"],
    world: "MAIN"
  });

  const [execution] = await chrome.scripting.executeScript({
    target,
    world: "MAIN",
    func: callTrstonPageTranslator,
    args: [method, payload]
  });
  const response = execution?.result;

  if (!response?.ok) {
    throw createError(response?.error);
  }

  return response.value;
}

async function callTrstonPageTranslator(method, payload) {
  try {
    const bridge = globalThis.__trstonPageTranslator;
    if (bridge?.version !== "trston-page-translator-v2" || typeof bridge[method] !== "function") {
      throw new Error("Trston page translator is not available.");
    }

    return {
      ok: true,
      value: await bridge[method](payload)
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error || "Unknown translation error")
      }
    };
  }
}

function createError(error) {
  const created = new Error(error?.message || "Unknown translation error");
  created.name = error?.name || "Error";
  return created;
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_OPEN_OPTIONS,
      title: chrome.i18n.getMessage("contextOpenSettings") || "Open Trston settings",
      contexts: ["action"]
    });

    chrome.contextMenus.create({
      id: `${MENU_OPEN_OPTIONS}-page`,
      title: chrome.i18n.getMessage("contextOpenSettings") || "Trston settings",
      contexts: ["page"]
    });
  });
}

async function setBadge(tabId, state = "idle", text = "") {
  const badgeText = String(text ?? "").slice(0, 4);
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: BADGE_COLORS[state] ?? BADGE_COLORS.idle
  });
  await chrome.action.setBadgeText({ tabId, text: badgeText });
}

function serializeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: String(error ?? "Unknown error") };
}
