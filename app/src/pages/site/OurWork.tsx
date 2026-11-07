import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { samplePhoto, WORK, WORK_CATS } from '../../components/samplePhoto'

type Work = (typeof WORK)[number]

export function WorkCard({ w }: { w: Work }) {
  const { t } = useTranslation()
  const [before, setBefore] = useState(false)
  const title = t(`work.items.${w.id}.title`)

  return (
    <article className="card proj">
      <div className="proj-img">
        <img
          src={samplePhoto(w.room, before ? w.v[0] : w.v[1])}
          className={before ? 'is-before' : ''}
          alt={t('work.photoAlt', { title, which: before ? t('work.before') : t('work.after') })}
        />
        <div className="ba" role="group" aria-label={t('work.beforeOrAfter')}>
          <button type="button" aria-pressed={before} onClick={() => setBefore(true)}>
            {t('work.before')}
          </button>
          <button type="button" aria-pressed={!before} onClick={() => setBefore(false)}>
            {t('work.after')}
          </button>
        </div>
      </div>
      <div className="proj-body">
        <div className="small muted meta">
          <span>{w.city}</span>
          <span>{t('work.weeks', { count: w.weeks })}</span>
        </div>
        <h3 style={{ fontSize: 17, margin: '4px 0 6px' }}>{title}</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 14.5 }}>
          {t(`work.items.${w.id}.desc`)}
        </p>
        <div className="chips">
          {w.services.map((s) => (
            <span key={s} className="pill">
              {t(`options.services.${s}.name`)}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

export default function OurWork() {
  const { t } = useTranslation()
  const [cat, setCat] = useState<(typeof WORK_CATS)[number]>('all')
  const list = WORK.filter((w) => cat === 'all' || w.cat === cat)

  return (
    <section className="sect">
      <div className="wrap">
        <div className="sec-head">
          <h1>{t('work.title')}</h1>
          <p>{t('work.lead')}</p>
        </div>
        <div className="tabs" style={{ marginBottom: 20 }}>
          {WORK_CATS.map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {t(`work.cats.${c}`)}
            </button>
          ))}
        </div>
        <div className="cards g3">
          {list.length ? list.map((w) => <WorkCard key={w.id} w={w} />) : <div className="empty">{t('work.empty')}</div>}
        </div>
        <p className="small muted mt">{t('work.photosNote')}</p>
        <p className="small muted">
          <span className="ph">{t('work.sampleNote')}</span>
        </p>
        <div className="cta-band" style={{ marginTop: 40 }}>
          <div>
            <h2>{t('work.ctaTitle')}</h2>
            <p>{t('work.ctaText')}</p>
          </div>
          <Link className="btn" to="/request">
            {t('site.cta')}
          </Link>
        </div>
      </div>
    </section>
  )
}
