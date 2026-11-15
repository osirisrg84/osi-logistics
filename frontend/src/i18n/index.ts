import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

// Archivos extra de traduccion (i18n/extra/*.es.json y *.en.json): se mezclan con es.json / en.json.
type Dict = Record<string, unknown>;
const isObj = (v: unknown): v is Dict => !!v && typeof v === 'object' && !Array.isArray(v);
function merge(base: Dict, extra: Dict): Dict {
  const out: Dict = { ...base };
  for (const k of Object.keys(extra)) out[k] = isObj(out[k]) && isObj(extra[k]) ? merge(out[k] as Dict, extra[k] as Dict) : extra[k];
  return out;
}
const extras = import.meta.glob('./extra/*.json', { eager: true, import: 'default' }) as Record<string, Dict>;
let enAll: Dict = en as Dict;
let esAll: Dict = es as Dict;
for (const path of Object.keys(extras).sort()) {
  if (path.endsWith('.en.json')) enAll = merge(enAll, extras[path]);
  else if (path.endsWith('.es.json')) esAll = merge(esAll, extras[path]);
}

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
  resources: { en: { translation: enAll }, es: { translation: esAll } },
  lng: initialLang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18next;
