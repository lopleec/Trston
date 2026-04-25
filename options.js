import {
  DEFAULT_SETTINGS,
  SUPPORTED_LANGUAGES,
  coerceSettings,
  getLanguageLabel,
  normalizeSitePattern
} from "./src/languages.js";
import {
  getCapabilityStatus,
  prepareTranslator,
  translateTexts
} from "./src/translation_engine.js";

const form = document.getElementById("settings-form");
const targetLanguage = document.getElementById("target-language");
const showOverlay = document.getElementById("show-overlay");
const autoTranslate = document.getElementById("auto-translate");
const streamTranslation = document.getElementById("stream-translation");
const translateTitle = document.getElementById("translate-title");
const neverLanguage = document.getElementById("never-language");
const addNeverLanguage = document.getElementById("add-never-language");
const neverLanguageList = document.getElementById("never-language-list");
const neverSite = document.getElementById("never-site");
const addNeverSite = document.getElementById("add-never-site");
const neverSiteList = document.getElementById("never-site-list");
const maxNodes = document.getElementById("max-nodes");
const saveState = document.getElementById("save-state");
const engineState = document.getElementById("engine-state");
const translatorStatus = document.getElementById("translator-status");
const detectorStatus = document.getElementById("detector-status");
const pairStatus = document.getElementById("pair-status");
const fallbackStatus = document.getElementById("fallback-status");
const refreshStatus = document.getElementById("refresh-status");
const preparePack = document.getElementById("prepare-pack");
const downloadMeter = document.getElementById("download-meter");
const downloadMeterBar = document.getElementById("download-meter-bar");
const sourceLanguage = document.getElementById("source-language");
const testTargetLanguage = document.getElementById("test-target-language");
const testInput = document.getElementById("test-input");
const testOutput = document.getElementById("test-output");
const runTest = document.getElementById("run-test");
const testState = document.getElementById("test-state");
let selectedNeverTranslateLanguages = [];
let selectedNeverTranslateSites = [];

init();

async function init() {
  localizeStaticText();
  fillLanguageSelect(targetLanguage);
  fillLanguageSelect(sourceLanguage);
  fillLanguageSelect(testTargetLanguage);
  fillLanguageSelect(neverLanguage);

  const settings = await loadSettings();
  renderSettings(settings);
  await refreshEngineStatus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettingsFromForm();
  });
  form.addEventListener("input", markSettingsDirty);
  form.addEventListener("change", markSettingsDirty);

  targetLanguage.addEventListener("change", () => {
    testTargetLanguage.value = targetLanguage.value;
    refreshEngineStatus();
  });
  sourceLanguage.addEventListener("change", refreshEngineStatus);
  refreshStatus.addEventListener("click", refreshEngineStatus);
  preparePack.addEventListener("click", prepareCurrentLanguagePack);
  runTest.addEventListener("click", runLocalTest);
  addNeverLanguage.addEventListener("click", addNeverTranslateLanguage);
  addNeverSite.addEventListener("click", addNeverTranslateSite);
  neverSite.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addNeverTranslateSite();
    }
  });
}

function fillLanguageSelect(select) {
  const locale = chrome.i18n.getUILanguage();
  select.replaceChildren(
    ...SUPPORTED_LANGUAGES.map((language) => {
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = getLanguageLabel(language.code, locale);
      return option;
    })
  );
}

async function loadSettings() {
  const response = await sendMessage({ type: "TRSTON_GET_SETTINGS" });
  if (!response?.ok) {
    return DEFAULT_SETTINGS;
  }

  return coerceSettings(response.settings);
}

function renderSettings(settings) {
  targetLanguage.value = settings.targetLanguage;
  testTargetLanguage.value = settings.targetLanguage;
  sourceLanguage.value = settings.targetLanguage === "en" ? "zh" : "en";
  showOverlay.checked = settings.showOverlay;
  autoTranslate.checked = settings.autoTranslate;
  streamTranslation.checked = settings.streamTranslation;
  translateTitle.checked = settings.translateTitle;
  selectedNeverTranslateLanguages = [...settings.neverTranslateLanguages];
  selectedNeverTranslateSites = [...settings.neverTranslateSites];
  renderNeverTranslateLanguages();
  renderNeverTranslateSites();
  maxNodes.value = settings.maxNodes;
  saveState.textContent = t("synced", "Synced");
  saveState.className = "ok";
}

async function saveSettingsFromForm() {
  saveState.textContent = t("saving", "Saving");
  saveState.className = "warn";

  const settings = {
    targetLanguage: targetLanguage.value,
    showOverlay: showOverlay.checked,
    autoTranslate: autoTranslate.checked,
    streamTranslation: streamTranslation.checked,
    translateTitle: translateTitle.checked,
    neverTranslateLanguages: selectedNeverTranslateLanguages,
    neverTranslateSites: selectedNeverTranslateSites,
    maxNodes: Number(maxNodes.value)
  };

  const response = await sendMessage({
    type: "TRSTON_SAVE_SETTINGS",
    settings
  });

  if (!response?.ok) {
    saveState.textContent = t("saveFailed", "Save failed");
    saveState.className = "bad";
    return;
  }

  renderSettings(response.settings);
  await refreshEngineStatus();
}

function addNeverTranslateSite() {
  const site = normalizeSitePattern(neverSite.value);
  if (!site || selectedNeverTranslateSites.includes(site)) {
    return;
  }

  selectedNeverTranslateSites = [...selectedNeverTranslateSites, site];
  neverSite.value = "";
  renderNeverTranslateSites();
  markSettingsDirty();
}

function removeNeverTranslateSite(site) {
  selectedNeverTranslateSites = selectedNeverTranslateSites.filter((currentSite) => currentSite !== site);
  renderNeverTranslateSites();
  markSettingsDirty();
}

function renderNeverTranslateSites() {
  if (selectedNeverTranslateSites.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-note";
    empty.textContent = t("noSitesSelected", "No websites added");
    neverSiteList.replaceChildren(empty);
    return;
  }

  neverSiteList.replaceChildren(
    ...selectedNeverTranslateSites.map((site) => {
      const button = document.createElement("button");
      button.className = "language-chip";
      button.type = "button";
      button.textContent = site;
      button.title = t("removeSite", "Remove $SITE$", [site]);
      button.addEventListener("click", () => removeNeverTranslateSite(site));
      return button;
    })
  );
}

async function refreshEngineStatus() {
  engineState.textContent = t("checking", "Checking");
  engineState.className = "warn";

  try {
    const status = await getCapabilityStatus({
      sourceLanguage: sourceLanguage.value || "en",
      targetLanguage: targetLanguage.value || "zh"
    });

    engineState.textContent = status.translatorSupported ? t("available", "Available") : t("fallbackMode", "Fallback");
    engineState.className = status.translatorSupported ? "ok" : "warn";
    translatorStatus.textContent = status.translatorSupported ? t("available", "Available") : t("unavailable", "Unavailable");
    translatorStatus.className = status.translatorSupported ? "ok" : "warn";
    detectorStatus.textContent = status.detectorSupported ? t("available", "Available") : t("unavailable", "Unavailable");
    detectorStatus.className = status.detectorSupported ? "ok" : "warn";
    pairStatus.textContent = describeAvailability(status.pairAvailability);
    pairStatus.className = status.pairAvailability === "unavailable" ? "bad" : "ok";
    fallbackStatus.textContent = t("glossaryCount", "$COUNT$ common entries", [String(status.fallbackDictionary.concepts)]);
    fallbackStatus.className = "ok";
    preparePack.disabled = !status.translatorSupported || sourceLanguage.value === targetLanguage.value;
  } catch (error) {
    engineState.textContent = t("detectFailed", "Check failed");
    engineState.className = "bad";
    translatorStatus.textContent = error.message || t("detectFailed", "Check failed");
    translatorStatus.className = "bad";
  }
}

async function prepareCurrentLanguagePack() {
  preparePack.disabled = true;
  engineState.textContent = t("preparing", "Preparing");
  engineState.className = "warn";
  downloadMeter.hidden = false;
  downloadMeterBar.style.transform = "scaleX(0)";

  try {
    await prepareTranslator(sourceLanguage.value, targetLanguage.value, {
      onProgress(progress) {
        const value = Number.isFinite(progress.progress) ? progress.progress : 0;
        downloadMeterBar.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
        pairStatus.textContent = t("downloading", "Downloading $PERCENT$%", [String(Math.round(value * 100))]);
        pairStatus.className = "warn";
      }
    });

    downloadMeterBar.style.transform = "scaleX(1)";
    engineState.textContent = t("ready", "Ready");
    engineState.className = "ok";
    pairStatus.textContent = t("available", "Available");
    pairStatus.className = "ok";
  } catch (error) {
    engineState.textContent = t("prepareFailed", "Preparation failed");
    engineState.className = "bad";
    pairStatus.textContent = error.message || t("prepareFailed", "Preparation failed");
    pairStatus.className = "bad";
  } finally {
    preparePack.disabled = false;
  }
}

async function runLocalTest() {
  testState.textContent = t("translating", "Translating");
  testState.className = "warn";
  testOutput.value = "";

  try {
    const result = await translateTexts([testInput.value], {
      sourceLanguage: sourceLanguage.value,
      targetLanguage: testTargetLanguage.value,
      sample: testInput.value,
      onProgress(progress) {
        const value = Number.isFinite(progress.progress) ? progress.progress : 0;
        testState.textContent = t("downloading", "Downloading $PERCENT$%", [String(Math.round(value * 100))]);
      }
    });

    testOutput.value = result.translations[0] || "";
    testState.textContent =
      result.engine === "chrome-translator" ? t("chromeLocalEngine", "Chrome local engine") : t("offlineGlossary", "Offline glossary");
    testState.className = result.engine === "chrome-translator" ? "ok" : "warn";
  } catch (error) {
    testState.textContent = t("translationFailed", "Translation failed");
    testState.className = "bad";
    testOutput.value = error.message || "Translation failed.";
  }
}

function addNeverTranslateLanguage() {
  const code = neverLanguage.value;
  if (!code || selectedNeverTranslateLanguages.includes(code)) {
    return;
  }

  selectedNeverTranslateLanguages = [...selectedNeverTranslateLanguages, code];
  renderNeverTranslateLanguages();
  markSettingsDirty();
}

function removeNeverTranslateLanguage(code) {
  selectedNeverTranslateLanguages = selectedNeverTranslateLanguages.filter((languageCode) => languageCode !== code);
  renderNeverTranslateLanguages();
  markSettingsDirty();
}

function renderNeverTranslateLanguages() {
  const locale = chrome.i18n.getUILanguage();

  if (selectedNeverTranslateLanguages.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-note";
    empty.textContent = t("noLanguagesSelected", "No languages added");
    neverLanguageList.replaceChildren(empty);
    return;
  }

  neverLanguageList.replaceChildren(
    ...selectedNeverTranslateLanguages.map((code) => {
      const label = getLanguageLabel(code, locale);
      const button = document.createElement("button");
      button.className = "language-chip";
      button.type = "button";
      button.textContent = label;
      button.title = t("removeLanguage", "Remove $LANGUAGE$", [label]);
      button.addEventListener("click", () => removeNeverTranslateLanguage(code));
      return button;
    })
  );
}

function describeAvailability(value) {
  if (value === "available") {
    return t("available", "Available");
  }

  if (value === "downloadable") {
    return t("downloadable", "Downloadable - click Prepare language pack");
  }

  if (value === "downloading") {
    return t("downloading", "Downloading $PERCENT$%", [""]);
  }

  if (value === "unavailable") {
    return t("unavailable", "Unavailable");
  }

  return "-";
}

function localizeStaticText() {
  const uiLanguage = chrome.i18n.getUILanguage().replace("_", "-");
  document.documentElement.lang = uiLanguage;
  document.title = t("optionsTitle", "Trston Settings");
  testInput.value = t("testSeedText", "Hello, thank you for using Trston.");

  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.dataset.i18n;
    const message = t(key, element.textContent);
    if (message) {
      element.textContent = message;
    }
  }

  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    const key = element.dataset.i18nPlaceholder;
    const message = t(key, element.getAttribute("placeholder") || "");
    if (message) {
      element.setAttribute("placeholder", message);
    }
  }
}

function t(key, fallback, substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || fallback;
}

function markSettingsDirty() {
  saveState.textContent = t("unsaved", "Unsaved");
  saveState.className = "warn";
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}
