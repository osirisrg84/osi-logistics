import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

const saved = localStorage.getItem('osi_lang');
// Mirrors LanguageContext's first-visit default: fall back to the device's
// own language (navigator.language) instead of always Spanish, so this
// module-level init doesn't paint the wrong language before that context's
// effect corrects it.
const initialLang =
  saved === 'en' || saved === 'es'
    ? saved
    : navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';

i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: initialLang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18next;
