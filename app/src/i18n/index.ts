import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import es from './es.json'

export type Language = 'en' | 'es'
/** The customer site and Jorge's dashboard remember their language separately. */
export type Scope = 'site' | 'admin'

const STORAGE_KEY: Record<Scope, string> = { site: 'jlp-site-lang', admin: 'jlp-admin-lang' }

export function storedLanguage(scope: Scope): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY[scope])
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // storage blocked (private window): fall through to the default
  }
  if (scope === 'admin') return 'es' // Jorge's dashboard is Spanish by default
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function setLanguage(scope: Scope, lng: Language) {
  try {
    localStorage.setItem(STORAGE_KEY[scope], lng)
  } catch {
    // not saved; still switch for this visit
  }
  i18n.changeLanguage(lng)
}

export const scopeForPath = (path: string): Scope => (path.startsWith('/admin') ? 'admin' : 'site')

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: storedLanguage(scopeForPath(location.pathname)),
  supportedLngs: ['en', 'es'],
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  showSupportNotice: false,
})

// Keep <html lang> in sync for screen readers (WCAG 3.1.1).
const setHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
setHtmlLang(i18n.language)
i18n.on('languageChanged', setHtmlLang)

export default i18n
