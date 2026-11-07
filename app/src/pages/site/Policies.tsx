import { useTranslation } from 'react-i18next'

export default function Policies() {
  const { t } = useTranslation()
  const sections = t('policies.sections', { returnObjects: true }) as { h: string; p: string }[]

  return (
    <section className="sect">
      <div className="wrap" style={{ maxWidth: 780 }}>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 40px)' }}>{t('policies.title')}</h1>
        <p className="tips">{t('policies.draft')}</p>
        {sections.map((s) => (
          <div key={s.h}>
            <h2 style={{ fontSize: 20, marginTop: 28 }}>{s.h}</h2>
            <p className="muted">{s.p}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
