import { createI18n } from "vue-i18n";
import type { WritableComputedRef } from "vue";
import en from "./en";
import zhCN from "./zh-CN";

export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;
export const DEFAULT_LOCALE = "zh-CN";

const STORAGE_KEY = "wud-lang";

// 默认语言：优先读取本地存储，否则中文（zh-CN）
const savedLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
const initialLocale = (SUPPORTED_LOCALES as readonly string[]).includes(savedLang)
  ? savedLang
  : DEFAULT_LOCALE;

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: "en",
  messages: {
    en,
    "zh-CN": zhCN,
  },
});

/**
 * 当前语言的响应式引用（与 vue-i18n 全局 locale 为同一对象）。
 * 语言切换控件绑定它的 value 即可全局生效。
 */
export const currentLocale = i18n.global.locale as unknown as WritableComputedRef<string>;

/**
 * 切换语言：更新全局 locale、写入 localStorage，并同步 <html lang>。
 * @param locale 目标语言（zh-CN | en）
 */
export function setLocale(locale: string): void {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return;
  }
  currentLocale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.setAttribute("lang", locale);
}

export default i18n;
