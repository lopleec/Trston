import {
  DEFAULT_SETTINGS,
  coerceSettings
} from "./languages.js";

const MENU_OPEN_OPTIONS = "trston-open-options";
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
    files: ["src/page_translator.js"],
    world: "MAIN"
  });

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
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set(coerceSettings(stored));
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return coerceSettings(stored);
}

async function saveSettings(partialSettings) {
  const settings = coerceSettings({
    ...(await getSettings()),
    ...partialSettings
  });

  await chrome.storage.sync.set(settings);
  return settings;
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
