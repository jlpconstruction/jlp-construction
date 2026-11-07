import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <section className="sect">
      <div className="wrap" style={{ textAlign: 'center' }}>
        <h1>{t('notFound.title')}</h1>
        <Link to="/" className="btn btn-dark mt">
          {t('notFound.backHome')}
        </Link>
      </div>
    </section>
  )
}
