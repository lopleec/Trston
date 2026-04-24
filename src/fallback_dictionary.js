import { SUPPORTED_LANGUAGE_CODES, normalizeLanguageCode } from "./languages.js";

const CONCEPTS = [
  { en: "hello", de: "hallo", fr: "bonjour", ja: "こんにちは", zh: "你好", es: "hola", ru: "привет" },
  { en: "goodbye", de: "auf wiedersehen", fr: "au revoir", ja: "さようなら", zh: "再见", es: "adios", ru: "до свидания" },
  { en: "yes", de: "ja", fr: "oui", ja: "はい", zh: "是", es: "si", ru: "да" },
  { en: "no", de: "nein", fr: "non", ja: "いいえ", zh: "不", es: "no", ru: "нет" },
  { en: "please", de: "bitte", fr: "s'il vous plait", ja: "お願いします", zh: "请", es: "por favor", ru: "пожалуйста" },
  { en: "thank you", de: "danke", fr: "merci", ja: "ありがとうございます", zh: "谢谢", es: "gracias", ru: "спасибо" },
  { en: "settings", de: "einstellungen", fr: "parametres", ja: "設定", zh: "设置", es: "configuracion", ru: "настройки" },
  { en: "open", de: "offnen", fr: "ouvrir", ja: "開く", zh: "打开", es: "abrir", ru: "открыть" },
  { en: "close", de: "schliessen", fr: "fermer", ja: "閉じる", zh: "关闭", es: "cerrar", ru: "закрыть" },
  { en: "save", de: "speichern", fr: "enregistrer", ja: "保存", zh: "保存", es: "guardar", ru: "сохранить" },
  { en: "cancel", de: "abbrechen", fr: "annuler", ja: "キャンセル", zh: "取消", es: "cancelar", ru: "отмена" },
  { en: "search", de: "suchen", fr: "rechercher", ja: "検索", zh: "搜索", es: "buscar", ru: "поиск" },
  { en: "download", de: "herunterladen", fr: "telecharger", ja: "ダウンロード", zh: "下载", es: "descargar", ru: "скачать" },
  { en: "upload", de: "hochladen", fr: "televerser", ja: "アップロード", zh: "上传", es: "subir", ru: "загрузить" },
  { en: "home", de: "startseite", fr: "accueil", ja: "ホーム", zh: "首页", es: "inicio", ru: "главная" },
  { en: "about", de: "uber", fr: "a propos", ja: "概要", zh: "关于", es: "acerca de", ru: "о нас" },
  { en: "contact", de: "kontakt", fr: "contact", ja: "連絡先", zh: "联系", es: "contacto", ru: "контакт" },
  { en: "login", de: "anmelden", fr: "connexion", ja: "ログイン", zh: "登录", es: "iniciar sesion", ru: "войти" },
  { en: "logout", de: "abmelden", fr: "deconnexion", ja: "ログアウト", zh: "退出登录", es: "cerrar sesion", ru: "выйти" },
  { en: "sign up", de: "registrieren", fr: "s'inscrire", ja: "登録", zh: "注册", es: "registrarse", ru: "зарегистрироваться" },
  { en: "account", de: "konto", fr: "compte", ja: "アカウント", zh: "账户", es: "cuenta", ru: "аккаунт" },
  { en: "profile", de: "profil", fr: "profil", ja: "プロフィール", zh: "个人资料", es: "perfil", ru: "профиль" },
  { en: "privacy", de: "datenschutz", fr: "confidentialite", ja: "プライバシー", zh: "隐私", es: "privacidad", ru: "конфиденциальность" },
  { en: "security", de: "sicherheit", fr: "securite", ja: "セキュリティ", zh: "安全", es: "seguridad", ru: "безопасность" },
  { en: "language", de: "sprache", fr: "langue", ja: "言語", zh: "语言", es: "idioma", ru: "язык" },
  { en: "translate", de: "ubersetzen", fr: "traduire", ja: "翻訳", zh: "翻译", es: "traducir", ru: "перевести" },
  { en: "translation", de: "ubersetzung", fr: "traduction", ja: "翻訳", zh: "翻译", es: "traduccion", ru: "перевод" },
  { en: "local", de: "lokal", fr: "local", ja: "ローカル", zh: "本地", es: "local", ru: "локальный" },
  { en: "page", de: "seite", fr: "page", ja: "ページ", zh: "页面", es: "pagina", ru: "страница" },
  { en: "text", de: "text", fr: "texte", ja: "テキスト", zh: "文本", es: "texto", ru: "текст" },
  { en: "error", de: "fehler", fr: "erreur", ja: "エラー", zh: "错误", es: "error", ru: "ошибка" },
  { en: "loading", de: "laden", fr: "chargement", ja: "読み込み中", zh: "加载中", es: "cargando", ru: "загрузка" },
  { en: "complete", de: "fertig", fr: "termine", ja: "完了", zh: "完成", es: "completo", ru: "готово" },
  { en: "new", de: "neu", fr: "nouveau", ja: "新規", zh: "新建", es: "nuevo", ru: "новый" },
  { en: "edit", de: "bearbeiten", fr: "modifier", ja: "編集", zh: "编辑", es: "editar", ru: "редактировать" },
  { en: "delete", de: "loschen", fr: "supprimer", ja: "削除", zh: "删除", es: "eliminar", ru: "удалить" },
  { en: "copy", de: "kopieren", fr: "copier", ja: "コピー", zh: "复制", es: "copiar", ru: "копировать" },
  { en: "share", de: "teilen", fr: "partager", ja: "共有", zh: "分享", es: "compartir", ru: "поделиться" },
  { en: "learn more", de: "mehr erfahren", fr: "en savoir plus", ja: "詳細を見る", zh: "了解更多", es: "mas informacion", ru: "узнать больше" },
  { en: "read more", de: "weiterlesen", fr: "lire la suite", ja: "続きを読む", zh: "阅读更多", es: "leer mas", ru: "читать далее" },
  { en: "get started", de: "loslegen", fr: "commencer", ja: "始める", zh: "开始使用", es: "empezar", ru: "начать" },
  { en: "next", de: "weiter", fr: "suivant", ja: "次へ", zh: "下一步", es: "siguiente", ru: "далее" },
  { en: "back", de: "zuruck", fr: "retour", ja: "戻る", zh: "返回", es: "atras", ru: "назад" },
  { en: "continue", de: "fortfahren", fr: "continuer", ja: "続ける", zh: "继续", es: "continuar", ru: "продолжить" },
  { en: "today", de: "heute", fr: "aujourd'hui", ja: "今日", zh: "今天", es: "hoy", ru: "сегодня" },
  { en: "tomorrow", de: "morgen", fr: "demain", ja: "明日", zh: "明天", es: "manana", ru: "завтра" },
  { en: "yesterday", de: "gestern", fr: "hier", ja: "昨日", zh: "昨天", es: "ayer", ru: "вчера" },
  { en: "help", de: "hilfe", fr: "aide", ja: "ヘルプ", zh: "帮助", es: "ayuda", ru: "помощь" },
  { en: "support", de: "support", fr: "assistance", ja: "サポート", zh: "支持", es: "soporte", ru: "поддержка" },
  { en: "price", de: "preis", fr: "prix", ja: "価格", zh: "价格", es: "precio", ru: "цена" },
  { en: "free", de: "kostenlos", fr: "gratuit", ja: "無料", zh: "免费", es: "gratis", ru: "бесплатно" },
  { en: "update", de: "aktualisieren", fr: "mettre a jour", ja: "更新", zh: "更新", es: "actualizar", ru: "обновить" },
  { en: "email", de: "e-mail", fr: "e-mail", ja: "メール", zh: "电子邮件", es: "correo", ru: "электронная почта" },
  { en: "password", de: "passwort", fr: "mot de passe", ja: "パスワード", zh: "密码", es: "contrasena", ru: "пароль" },
  { en: "name", de: "name", fr: "nom", ja: "名前", zh: "名称", es: "nombre", ru: "имя" },
  { en: "address", de: "adresse", fr: "adresse", ja: "住所", zh: "地址", es: "direccion", ru: "адрес" },
  { en: "news", de: "nachrichten", fr: "actualites", ja: "ニュース", zh: "新闻", es: "noticias", ru: "новости" },
  { en: "product", de: "produkt", fr: "produit", ja: "製品", zh: "产品", es: "producto", ru: "продукт" },
  { en: "service", de: "dienst", fr: "service", ja: "サービス", zh: "服务", es: "servicio", ru: "сервис" },
  { en: "document", de: "dokument", fr: "document", ja: "文書", zh: "文档", es: "documento", ru: "документ" },
  { en: "image", de: "bild", fr: "image", ja: "画像", zh: "图片", es: "imagen", ru: "изображение" },
  { en: "video", de: "video", fr: "video", ja: "動画", zh: "视频", es: "video", ru: "видео" },
  { en: "audio", de: "audio", fr: "audio", ja: "音频", zh: "音频", es: "audio", ru: "аудио" },
  { en: "file", de: "datei", fr: "fichier", ja: "ファイル", zh: "文件", es: "archivo", ru: "файл" },
  { en: "folder", de: "ordner", fr: "dossier", ja: "フォルダ", zh: "文件夹", es: "carpeta", ru: "папка" },
  { en: "message", de: "nachricht", fr: "message", ja: "メッセージ", zh: "消息", es: "mensaje", ru: "сообщение" },
  { en: "send", de: "senden", fr: "envoyer", ja: "送信", zh: "发送", es: "enviar", ru: "отправить" },
  { en: "receive", de: "empfangen", fr: "recevoir", ja: "受信", zh: "接收", es: "recibir", ru: "получить" },
  { en: "start", de: "starten", fr: "demarrer", ja: "開始", zh: "开始", es: "iniciar", ru: "старт" },
  { en: "stop", de: "stoppen", fr: "arreter", ja: "停止", zh: "停止", es: "detener", ru: "остановить" },
  { en: "retry", de: "erneut versuchen", fr: "reessayer", ja: "再試行", zh: "重试", es: "reintentar", ru: "повторить" },
  { en: "refresh", de: "aktualisieren", fr: "actualiser", ja: "更新", zh: "刷新", es: "refrescar", ru: "обновить" },
  { en: "menu", de: "menu", fr: "menu", ja: "メニュー", zh: "菜单", es: "menu", ru: "меню" },
  { en: "result", de: "ergebnis", fr: "resultat", ja: "結果", zh: "结果", es: "resultado", ru: "результат" },
  { en: "available", de: "verfugbar", fr: "disponible", ja: "利用可能", zh: "可用", es: "disponible", ru: "доступно" },
  { en: "unavailable", de: "nicht verfugbar", fr: "indisponible", ja: "利用不可", zh: "不可用", es: "no disponible", ru: "недоступно" }
];

const EXACT_LOOKUP = buildExactLookup();
const PHRASE_LOOKUP = buildPhraseLookup();
const WORD_PATTERN = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)?/gu;

export function translateWithLocalGlossary(text, sourceLanguage, targetLanguage) {
  const source = normalizeLanguageCode(sourceLanguage);
  const target = normalizeLanguageCode(targetLanguage);

  if (!source || !target || source === target || !text) {
    return text;
  }

  const exact = lookupExact(text, source, target);
  if (exact) {
    return preserveOuterWhitespace(text, exact);
  }

  let translated = replacePhrases(text, source, target);
  translated = translated.replace(WORD_PATTERN, (word) => {
    const replacement = EXACT_LOOKUP.get(keyFor(source, target, normalizeToken(word)));
    return replacement ? preserveCase(word, replacement) : word;
  });

  return translated;
}

export function getFallbackDictionaryStats() {
  return {
    concepts: CONCEPTS.length,
    languagePairs: SUPPORTED_LANGUAGE_CODES.length * (SUPPORTED_LANGUAGE_CODES.length - 1)
  };
}

function buildExactLookup() {
  const lookup = new Map();

  for (const concept of CONCEPTS) {
    for (const source of SUPPORTED_LANGUAGE_CODES) {
      for (const target of SUPPORTED_LANGUAGE_CODES) {
        if (source === target || !concept[source] || !concept[target]) {
          continue;
        }

        lookup.set(keyFor(source, target, normalizeToken(concept[source])), concept[target]);
      }
    }
  }

  return lookup;
}

function buildPhraseLookup() {
  const lookup = new Map();

  for (const concept of CONCEPTS) {
    for (const source of SUPPORTED_LANGUAGE_CODES) {
      for (const target of SUPPORTED_LANGUAGE_CODES) {
        if (source === target || !concept[source] || !concept[target]) {
          continue;
        }

        if (concept[source].length < 4) {
          continue;
        }

        const sourceText = concept[source];
        const containsSeparator = /[\s'-]/.test(sourceText) || /[ぁ-んァ-ヶ一-龯]/.test(sourceText);
        if (containsSeparator) {
          lookup.set(keyFor(source, target, normalizeToken(sourceText)), {
            sourceText,
            targetText: concept[target]
          });
        }
      }
    }
  }

  return lookup;
}

function lookupExact(text, source, target) {
  return EXACT_LOOKUP.get(keyFor(source, target, normalizeToken(text))) ?? null;
}

function replacePhrases(text, source, target) {
  const phrases = [...PHRASE_LOOKUP.entries()]
    .filter(([key]) => key.startsWith(`${source}:${target}:`))
    .map(([, phrase]) => phrase)
    .sort((a, b) => b.sourceText.length - a.sourceText.length);

  let output = text;
  for (const { sourceText, targetText } of phrases) {
    if (containsCjk(sourceText)) {
      output = output.split(sourceText).join(targetText);
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(sourceText)}\\b`, "giu");
    output = output.replace(pattern, (match) => preserveCase(match, targetText));
  }

  return output;
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

function keyFor(source, target, text) {
  return `${source}:${target}:${text}`;
}

function preserveOuterWhitespace(original, translated) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${preserveCase(original.trim(), translated)}${trailing}`;
}

function preserveCase(original, translated) {
  if (!hasLatinLetters(original) || !hasLatinLetters(translated)) {
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

function hasLatinLetters(value) {
  return /[A-Za-z]/.test(value);
}

function containsCjk(value) {
  return /[ぁ-んァ-ヶ一-龯]/.test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
