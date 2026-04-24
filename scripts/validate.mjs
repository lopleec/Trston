import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { translateWithLocalGlossary } from "../src/fallback_dictionary.js";
import { heuristicDetectLanguage } from "../src/translation_engine.js";

const root = dirname(fileURLToPath(new URL("../manifest.json", import.meta.url)));
const manifestPath = join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.name === "__MSG_extName__", "manifest name must use i18n");
assert(manifest.default_locale === "en", "manifest default_locale must be en");
assert(manifest.action && !manifest.action.default_popup, "toolbar click must trigger action.onClicked");
assert(manifest.options_ui?.page, "options_ui.page is required");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length >= 2, "auto content scripts are required");
assert(manifest.commands?.["toggle-translation"], "toggle translation command is required");

const requiredPaths = [
  manifest.background.service_worker,
  manifest.options_ui.page,
  "options.css",
  "options.js",
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
];

for (const relativePath of requiredPaths) {
  assert(existsSync(join(root, relativePath)), `Missing required path: ${relativePath}`);
}

const jsFiles = [
  "src/languages.js",
  "src/fallback_dictionary.js",
  "src/translation_engine.js",
  "src/page_translator.js",
  "src/service_worker.js",
  "src/content_script.js",
  "options.js",
  "scripts/make-icons.mjs",
  "scripts/validate.mjs"
];

for (const file of jsFiles) {
  execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "pipe" });
}

assert(heuristicDetectLanguage("Bonjour et merci pour votre aide") === "fr", "French heuristic failed");
assert(heuristicDetectLanguage("今日はありがとうございます") === "ja", "Japanese heuristic failed");
assert(
  translateWithLocalGlossary("Hello, settings", "en", "zh").includes("你好"),
  "Fallback glossary failed"
);

const enMessages = JSON.parse(readFileSync(join(root, "_locales/en/messages.json"), "utf8"));
assert(enMessages.extName?.message === "Trston", "English locale name must be Trston");
validateLocales(enMessages);

console.log("Trston validation passed.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateLocales(defaultMessages) {
  const localeRoot = join(root, "_locales");
  const expectedKeys = Object.keys(defaultMessages).sort();

  for (const locale of readdirSync(localeRoot)) {
    const messagesPath = join(localeRoot, locale, "messages.json");
    if (!existsSync(messagesPath)) {
      continue;
    }

    const messages = JSON.parse(readFileSync(messagesPath, "utf8"));
    const keys = Object.keys(messages).sort();
    assert(
      JSON.stringify(keys) === JSON.stringify(expectedKeys),
      `Locale ${locale} does not match default message keys`
    );

    for (const key of keys) {
      assert(typeof messages[key].message === "string", `Locale ${locale} key ${key} must have a message`);
    }
  }
}
