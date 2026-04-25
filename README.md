# Trston

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Chrome 138+](https://img.shields.io/badge/Chrome-138%2B-yellow?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Version](https://img.shields.io/badge/version-0.1.0-informational)](manifest.json)
[![On-device AI](https://img.shields.io/badge/AI-On--device%20only-brightgreen?logo=artificialintelligence&logoColor=white)]()
[![No Remote API](https://img.shields.io/badge/Remote%20API-None-critical)]()

**Local-first Chrome page translator · On-device AI · Streaming viewport translation**

<br/>

[English](#english) · [中文](#中文)

</div>

---

## English

### What It Does

**Trston** is a Chrome Manifest V3 extension that translates web pages into your preferred language using Chrome's built-in on-device translation APIs — no API key, no cloud endpoint, no page text ever leaves your device.

It translates the visible area and nearby content first, then continues as you scroll, so long pages don't need to be processed all at once.

### Features

- 🔄 **Automatic translation** for `http`/`https` pages that are not in your preferred language.
- 🖥️ **Viewport streaming** — translate what's visible first, then continue as you scroll.
- 🔁 **Manual toggle** — restore or re-translate at any time via the floating status overlay.
- ⌨️ **Keyboard shortcut** — toggle between original and translated text instantly.
- 🚫 **Language blocklist** — never auto-translate from selected source languages.
- 🌐 **Website blocklist** — never auto-translate selected domains, subdomains, or path subtrees.
- 📦 **Language pack manager** — prepare on-device packs with progress tracking.
- 🌍 **Multilingual UI** — extension interface adapts to your browser language (10 locales).
- 🎨 **Light & dark mode** — clean black-and-white UI for both themes.
- 🔒 **Privacy-first** — no remote translation service, no custom server, no telemetry.

### Extension UI Languages

Chrome picks the extension locale from the browser UI language. Included locales:

| Locale | Language |
|---|---|
| `en` | English |
| `zh_CN` | 简体中文 (Simplified Chinese) |
| `zh_TW` | 繁體中文 (Traditional Chinese) |
| `ja` | 日本語 (Japanese) |
| `ko` | 한국어 (Korean) |
| `de` | Deutsch (German) |
| `fr` | Français (French) |
| `es` | Español (Spanish) |
| `pt_BR` | Português (Brazil) |
| `ru` | Русский (Russian) |

Other browser languages fall back to English.

### Supported Translation Languages

Trston exposes all languages available through Chrome's Translator API, including but not limited to:

English, German, French, Japanese, Simplified Chinese, Traditional Chinese, Spanish, Russian, Korean, Italian, Portuguese, Dutch, Polish, Turkish, Ukrainian, Vietnamese, Thai, Arabic, Hindi, and more.

> Actual availability depends on your Chrome version and the language packs Chrome can prepare on your device.

### Keyboard Shortcuts

| System | Page shortcut | Extension shortcut |
|---|---|---|
| macOS | `Cmd+J` (if not claimed by Chrome) | `Option+J` |
| Windows | `Ctrl+J` (if not claimed by Chrome) | `Alt+J` |
| Linux / ChromeOS | `Ctrl+J` (if not claimed by Chrome) | `Alt+J` |

> Chrome may reserve `Cmd+J` / `Ctrl+J` for Downloads. If so, use the extension shortcut or set a custom command at `chrome://extensions/shortcuts`.

### Website Blocklist Patterns

`github.com` blocks the whole domain, including pages such as `github.com/lopleec` and subdomains.

`github.com/lopleec` blocks only that path and child pages, such as `github.com/lopleec/project`, while leaving other GitHub paths available for automatic translation.

Website blocklist entries are stored in `chrome.storage.local` and stay on the current device. General preferences, such as target language and overlay settings, use `chrome.storage.sync` so they can follow the Chrome profile.

### Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the root folder of this repository.
5. Open the Trston settings page and choose your target language.
6. If a language pair shows as `downloadable`, click **Prepare language pack** and wait for it to finish.

### Development

```bash
npm run make:icons   # generate icon PNGs from source
npm run validate     # check manifest, files, JS syntax, locale key consistency
```

### Permissions

Trston requests host permissions for `http://` and `https://` pages so translation can run automatically without a toolbar click. The extension:

- does **not** include any remote translation service
- does **not** send page text to any external server
- does **not** collect any user data

> Chrome blocks script injection on internal pages such as `chrome://extensions`, the Chrome Web Store, and other browser-owned pages.

### Local Engine Notes

Chrome's Translator API and Language Detector API require **desktop Chrome 138+**. Chrome may download language packs the first time a language pair is used; after that, all translation runs fully on-device.

The Translator API is unavailable in Web Workers, so Trston invokes a small page-side bridge in the page's MAIN world with `chrome.scripting.executeScript`. Page text batches travel through extension messaging instead of `window.postMessage`.

**References**
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Chrome Language Detection API](https://developer.chrome.com/docs/ai/language-detection)
- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)

### License

[MIT](LICENSE)

---

## 中文

### 简介

**Trston** 是一款基于 Chrome Manifest V3 的浏览器扩展，使用 Chrome 内置的设备端翻译 API 将网页翻译为您偏好的语言 —— 无需 API 密钥，无需云端接口，页面文字始终不离开您的设备。

扩展优先翻译可见区域及附近内容，随着滚动持续处理，长页面无需一次性全量翻译。

### 功能特性

- 🔄 **自动翻译** — 对非目标语言的 `http`/`https` 页面自动触发翻译。
- 🖥️ **视口流式翻译** — 优先翻译可见区域，滚动时持续推进。
- 🔁 **手动切换** — 通过悬浮状态栏随时还原或重新翻译。
- ⌨️ **快捷键** — 即时在原文与译文之间切换。
- 🚫 **语言黑名单** — 对指定来源语言永不自动翻译。
- 🌐 **网站黑名单** — 对指定域名、子域名或路径子树永不自动翻译。
- 📦 **语言包管理器** — 带进度提示的本地语言包准备工具。
- 🌍 **多语言界面** — 扩展 UI 随浏览器语言自动切换（支持 10 种语言）。
- 🎨 **明暗主题** — 简洁黑白风格，同时支持浅色与深色模式。
- 🔒 **隐私优先** — 无远程翻译服务、无自定义服务器、无遥测数据。

### 扩展界面语言

Chrome 根据浏览器 UI 语言自动选择扩展语言，已支持以下语言：

| 语言代码 | 语言名称 |
|---|---|
| `en` | English（英语）|
| `zh_CN` | 简体中文 |
| `zh_TW` | 繁體中文 |
| `ja` | 日本語（日语）|
| `ko` | 한국어（韩语）|
| `de` | Deutsch（德语）|
| `fr` | Français（法语）|
| `es` | Español（西班牙语）|
| `pt_BR` | Português（巴西葡语）|
| `ru` | Русский（俄语）|

未包含的浏览器语言将回退到英语。

### 支持的翻译语言

通过 Chrome Translator API，Trston 支持包括但不限于以下语言：

英语、德语、法语、日语、简体中文、繁体中文、西班牙语、俄语、韩语、意大利语、葡萄牙语、荷兰语、波兰语、土耳其语、乌克兰语、越南语、泰语、阿拉伯语、印地语等。

> 实际可用性取决于您的 Chrome 版本及设备上 Chrome 能够准备的语言包。

### 键盘快捷键

| 系统 | 页面快捷键 | 扩展快捷键 |
|---|---|---|
| macOS | `Cmd+J`（若未被 Chrome 占用）| `Option+J` |
| Windows | `Ctrl+J`（若未被 Chrome 占用）| `Alt+J` |
| Linux / ChromeOS | `Ctrl+J`（若未被 Chrome 占用）| `Alt+J` |

> Chrome 可能将 `Cmd+J` / `Ctrl+J` 用于"下载"。如遇冲突，请使用扩展快捷键，或在 `chrome://extensions/shortcuts` 中自定义。

### 网站黑名单匹配规则

`github.com` 会屏蔽整个域名，包括 `github.com/lopleec` 这样的页面和子域名。

`github.com/lopleec` 只会屏蔽这个路径及其子页面，例如 `github.com/lopleec/project`，不会影响 GitHub 的其他路径。

网站黑名单条目存储在 `chrome.storage.local`，只保存在当前设备。目标语言、浮层等普通偏好仍使用 `chrome.storage.sync`，可以跟随 Chrome 账号同步。

### 本地安装

1. 打开 `chrome://extensions`。
2. 启用右上角的**开发者模式**。
3. 点击**加载已解压的扩展程序**。
4. 选择本仓库的根目录文件夹。
5. 打开 Trston 设置页面，选择目标翻译语言。
6. 若某语言对显示为 `downloadable`，点击**准备语言包**并等待完成。

### 开发

```bash
npm run make:icons   # 从源文件生成图标 PNG
npm run validate     # 检查 manifest、文件完整性、JS 语法及语言键一致性
```

### 权限说明

Trston 申请 `http://` 和 `https://` 页面的主机权限，以便无需点击工具栏即可自动翻译。扩展：

- **不包含**任何远程翻译服务
- **不向**任何外部服务器发送页面文字
- **不收集**任何用户数据

> Chrome 会阻止在内部页面（如 `chrome://extensions`、Chrome 应用商店等）注入脚本。

### 本地引擎说明

Chrome 的 Translator API 和 Language Detector API 需要 **桌面版 Chrome 138 及以上版本**。首次使用某语言对时 Chrome 可能需要下载语言包，此后翻译完全在设备本地运行。

由于 Translator API 在 Web Worker 中不可用，Trston 会通过 `chrome.scripting.executeScript` 在页面 MAIN world 中调用一个很小的翻译桥接层。页面文本批次走扩展内部消息，不再通过 `window.postMessage` 传递。

**参考资料**
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Chrome Language Detection API](https://developer.chrome.com/docs/ai/language-detection)
- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)

### 开源协议

[MIT](LICENSE)
