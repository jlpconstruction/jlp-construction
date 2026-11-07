import { useTranslation } from 'react-i18next'
import { setLanguage, type Scope } from '../i18n'
import Icon from './Icon'

/** Switches between English and Spanish. The site and the dashboard each remember their own choice. */
export default function LanguageToggle({ scope, className = 'lang-btn' }: { scope: Scope; className?: string }) {
  const { t, i18n } = useTranslation()
  const next = i18n.language === 'es' ? 'en' : 'es'

  return (
    <button
      type="button"
      className={className}
      onClick={() => setLanguage(scope, next)}
      lang={next}
      aria-label={t('common.switchToLabel')}
    >
      <Icon name="globe" size={16} />
      <span className="lg-long">{t('common.switchTo')}</span>
      <span className="lg-short">{t('common.switchToShort')}</span>
    </button>
  )
}
