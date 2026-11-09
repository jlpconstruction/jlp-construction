import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { SERVICES } from '../../lib/options'
import { PROJECTS } from '../../lib/projects'
import { WorkCard } from './OurWork'

// Jorge's real work (from his Facebook page). `pos` picks the part of each tall photo to show.
const SERVICE_PHOTO: Record<(typeof SERVICES)[number], { src: string; pos: string }> = {
  interior: { src: '/work/suite-2.jpg', pos: '50% 55%' },
  painting: { src: '/work/b2.jpg', pos: '50% 42%' },
  tile: { src: '/work/mosaic-1.jpg', pos: '50% 40%' },
  flooring: { src: '/work/hall-1.jpg', pos: '50% 70%' },
  windows: { src: '/work/door-1.jpg', pos: '50% 40%' },
}

export default function Home() {
  const { t } = useTranslation()
  const how = t('home.how', { returnObjects: true }) as { t: string; d: string }[]
  const faq = t('home.faq', { returnObjects: true }) as { q: string; a: string }[]

  return (
    <>
      <section className="hero">
        <div className="hero-split">
          <div className="hero-copy">
            <h1>{t('home.title')}</h1>
            <p className="lead">{t('home.lead')}</p>
            <div className="ctas">
              <Link className="btn btn-primary" to="/request">
                <Icon name="cal" size={18} /> {t('site.cta')}
              </Link>
              <Link className="btn btn-ghost" to="/services">
                {t('home.seeServices')}
              </Link>
            </div>
            <p className="small serving">{t('home.serving')}</p>
          </div>
          <img className="hero-shot" src="/work/c1.jpg" alt={t('home.heroAlt')} fetchPriority="high" />
        </div>
      </section>

      <section className="sect">
        <div className="wrap">
          <div className="sec-head">
            <h2>{t('home.servicesTitle')}</h2>
            <p>{t('home.servicesLead')}</p>
          </div>
          <div className="cards g3">
            {SERVICES.map((s) => (
              <Link key={s} className="card svc has-photo" to="/services">
                <img className="svc-photo" src={SERVICE_PHOTO[s].src} alt="" loading="lazy" style={{ objectPosition: SERVICE_PHOTO[s].pos }} />
                <h3>{t(`options.services.${s}.name`)}</h3>
                <p>{t(`options.services.${s}.desc`)}</p>
              </Link>
            ))}
            <Link className="card svc not-sure" to="/request">
              <div className="ico">
                <Icon name="plus" />
              </div>
              <h3>{t('home.notSureTitle')}</h3>
              <p>{t('home.notSureText')}</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="hrow between wraps" style={{ alignItems: 'flex-end', marginBottom: 24 }}>
            <div className="sec-head" style={{ margin: 0 }}>
              <h2>{t('home.workTitle')}</h2>
            </div>
            <Link className="btn btn-ghost" to="/our-work">
              {t('home.seeAllWork')} <Icon name="arrowR" size={16} />
            </Link>
          </div>
          <div className="cards g3">
            {['gym', 'suite', 'lux'].map((id) => (
              <WorkCard key={id} p={PROJECTS.find((p) => p.id === id)!} />
            ))}
          </div>
        </div>
      </section>

      <section className="sect band">
        <div className="wrap cards g2" style={{ alignItems: 'center', gap: 40 }}>
          <div>
            <h2>{t('home.photosTitle')}</h2>
            <p className="muted">{t('home.photosText')}</p>
            <Link className="btn btn-dark mt" to="/request">
              {t('home.photosCta')}
            </Link>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 17 }}>{t('home.payTitle')}</h3>
            <div className="pay">
              <div>
                <strong>35%</strong>
                <span>{t('home.payFirst')}</span>
              </div>
              <div>
                <strong>35%</strong>
                <span>{t('home.payHalf')}</span>
              </div>
              <div>
                <strong>30%</strong>
                <span>{t('home.payDone')}</span>
              </div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {t('home.payNote')}
            </p>
          </div>
        </div>
      </section>

      <section className="how-band">
        <div className="wrap">
          <h2>{t('home.howTitle')}</h2>
          <ol>
            {how.map((s, i) => (
              <li key={i} className="hstep">
                <b>{i + 1}</b>
                <div>
                  <strong>{s.t}</strong>
                  {s.d}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sect">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="sec-head">
            <h2>{t('home.faqTitle')}</h2>
          </div>
          {faq.map((f) => (
            <details key={f.q} className="faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="cta-band">
          <div>
            <h2>{t('home.ctaTitle')}</h2>
            <p>{t('home.ctaText')}</p>
          </div>
          <Link className="btn" to="/request">
            {t('site.cta')}
          </Link>
        </div>
      </section>
    </>
  )
}
