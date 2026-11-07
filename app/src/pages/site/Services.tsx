import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { SERVICE_ICON, SERVICES } from '../../lib/options'

export default function Services() {
  const { t } = useTranslation()

  return (
    <section className="sect">
      <div className="wrap">
        <div className="sec-head">
          <h1>{t('services.title')}</h1>
          <p>{t('services.lead')}</p>
        </div>
        <div className="cards g3">
          {SERVICES.map((s) => (
            <div key={s} className="card svc">
              <div className="ico">
                <Icon name={SERVICE_ICON[s]} />
              </div>
              <h2 style={{ fontSize: 18 }}>{t(`options.services.${s}.name`)}</h2>
              <p>{t(`options.services.${s}.desc`)}</p>
              <ul>
                {(t(`options.services.${s}.items`, { returnObjects: true }) as string[]).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <Link className="btn btn-ghost btn-sm mt" to={`/request?service=${s}`}>
                {t('services.requestThis')}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
