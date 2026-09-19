import { createI18n } from "vue-i18n";
import en from "./en";
import zhCN from "./zh-CN";

// 默认语言：优先读取本地存储，否则中文（zh-CN）
const savedLang = localStorage.getItem("wud-lang") || "zh-CN";
const supported = ["en", "zh-CN"];
const locale = supported.includes(savedLang) ? savedLang : "zh-CN";

const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "en",
  messages: {
    en,
    "zh-CN": zhCN,
  },
});

export default i18n;
