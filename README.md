# Trston

Local-first Chrome page translator with on-device AI, streaming viewport translation, and multilingual settings.

## GitHub Description

Local-first Chrome page translator with on-device AI, streaming viewport translation, and multilingual settings.

## What It Does

Trston is a Chrome Manifest V3 extension that translates web pages into your preferred language using Chrome's built-in on-device translation APIs when available. It translates nearby content first, then continues as you scroll, so long pages do not need to be translated all at once.

## Features

- Automatic translation for ordinary `http` and `https` pages that are not in your preferred language.
- Viewport streaming: translate the visible area and nearby content first, then continue while scrolling.
- Manual restore/translate toggle from the floating status overlay.
- Keyboard toggle for original and translated text.
- Language blocklist: never auto-translate selected source languages.
- Website blocklist: never auto-translate selected domains or their subdomains.
- Local language-pack preparation with progress when Chrome reports a pair as `downloadable`.
- Multilingual extension UI through Chrome i18n.
- Black-and-white UI with light and dark mode.
- No remote translation API key and no cloud translation endpoint in the extension.

## Extension UI Languages

Chrome chooses the extension language from the browser UI language. Included locales:

- English
- Simplified Chinese
- Traditional Chinese
- Japanese
- Korean
- German
- French
- Spanish
- Portuguese (Brazil)
- Russian

Other browser languages fall back to English.

## Translation Languages

The settings page lists the languages exposed by Chrome's Translator API, including English, German, French, Japanese, Chinese, Traditional Chinese, Spanish, Russian, Korean, Italian, Portuguese, Dutch, Polish, Turkish, Ukrainian, Vietnamese, Thai, Arabic, Hindi, and more.

Actual availability depends on the Chrome version and the local language packs Chrome can prepare on that device.

## Shortcuts

| System | Page shortcut | Extension shortcut |
| --- | --- | --- |
| macOS | `Cmd+J` when the page receives it | `Option+J` |
| Windows | `Ctrl+J` when the page receives it | `Alt+J` |
| Linux / ChromeOS | `Ctrl+J` when the page receives it | `Alt+J` |

Chrome may reserve `Cmd+J` or `Ctrl+J` for Downloads. If that happens, use the extension shortcut or set a custom command at `chrome://extensions/shortcuts`.

## Local Engine Notes

Chrome's Translator API and Language Detector API are available on desktop Chrome 138+. Chrome may download language packs the first time a language pair is used. After that, translation runs on-device.

The Translator API is not available in Web Workers, so Trston injects a page-side bridge for translation and keeps the MV3 service worker limited to extension actions and commands.

Apple's macOS Translation framework is not directly callable from a pure Chrome extension. It would require a separate native messaging helper app plus the Chrome native messaging permission and host manifest.

References:

- https://developer.chrome.com/docs/ai/translator-api
- https://developer.chrome.com/docs/ai/language-detection
- https://developer.chrome.com/docs/ai/built-in-apis
- https://developer.apple.com/documentation/translation/

## Permissions

Trston declares host permissions for ordinary `http` and `https` pages so automatic translation can run without a toolbar click. The extension does not include a remote translation service or send page text to a custom server.

Chrome blocks script injection on internal pages such as `chrome://extensions`, the Chrome Web Store, and some browser-owned pages.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this folder: `/Users/luccazh/Documents/Programing☕️/Trston`.
5. Open Trston settings and choose your preferred target language.
6. If a language pair shows as `downloadable`, click **Prepare language pack**.

## Development

```bash
npm run make:icons
npm run validate
```

`npm run validate` checks the manifest, required files, JavaScript syntax, fallback translation basics, and locale key consistency.
