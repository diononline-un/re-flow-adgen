import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import de from "./i18n/locales/de.json";
import en from "./i18n/locales/en.json";
import fr from "./i18n/locales/fr.json";
import it from "./i18n/locales/it.json";
import nl from "./i18n/locales/nl.json";
import es from "./i18n/locales/es.json";

export const UI_LANGS = ["de", "en", "fr", "it", "nl", "es"] as const;

const saved = localStorage.getItem("adgen_ui_lang") ?? "de";

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
    fr: { translation: fr },
    it: { translation: it },
    nl: { translation: nl },
    es: { translation: es },
  },
  lng: saved,
  fallbackLng: "de",
  interpolation: { escapeValue: false },
});

export function setUiLang(lang: string): void {
  i18n.changeLanguage(lang);
  localStorage.setItem("adgen_ui_lang", lang);
}

export default i18n;
