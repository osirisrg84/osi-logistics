import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from '../i18n';

export type Lang = 'en' | 'es';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: 'es', setLang: () => {}, toggle: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('osi_lang');
    return saved === 'en' || saved === 'es' ? saved : 'es';
  });

  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem('osi_lang', lang);
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const toggle = () => setLangState(l => (l === 'en' ? 'es' : 'en'));

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
