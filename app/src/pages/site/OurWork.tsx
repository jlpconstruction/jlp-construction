import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PROJECTS, WORK_CATS, type Project } from '../../lib/projects'

/** One project: a Before/After switch when there's a real "before", and small photos to flip through. */
export function WorkCard({ p }: { p: Project }) {
  const { t } = useTranslation()
  const [showBefore, setShowBefore] = useState(false)
  const [current, setCurrent] = useState(0)
  const title = t(`work.items.${p.id}.title`)
  const src = showBefore && p.before ? p.before : p.photos[current]

  return (
    <article className="card proj">
      <div className="proj-img tall">
        <img
          src={src}
          alt={showBefore ? t('work.altBefore', { title }) : t('work.altPhoto', { title, n: current + 1, total: p.photos.length })}
          loading="lazy"
        />
        {p.before && (
          <div className="ba" role="group" aria-label={t('work.beforeOrAfter')}>
            <button type="button" aria-pressed={showBefore} onClick={() => setShowBefore(true)}>
              {t('work.before')}
            </button>
            <button type="button" aria-pressed={!showBefore} onClick={() => setShowBefore(false)}>
              {t('work.after')}
            </button>
          </div>
        )}
      </div>
      {p.photos.length > 1 && (
        <div className="proj-thumbs" role="group" aria-label={t('work.morePhotos')}>
          {p.photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              aria-pressed={!showBefore && current === i}
              aria-label={t('work.showPhoto', { n: i + 1, total: p.photos.length })}
              onClick={() => {
                setCurrent(i)
                setShowBefore(false)
              }}
            >
              <img src={photo} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="proj-body">
        <h3>{title}</h3>
        <p className="muted">{t(`work.items.${p.id}.desc`)}</p>
        <div className="chips">
          {p.services.map((s) => (
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
  const list = PROJECTS.filter((p) => cat === 'all' || p.cat === cat)

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
          {list.map((p) => (
            <WorkCard key={p.id} p={p} />
          ))}
        </div>
        <p className="small muted mt">{t('work.photosNote')}</p>
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
