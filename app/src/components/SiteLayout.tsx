import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import i18n, { storedLanguage } from '../i18n'
import { PHONE } from '../lib/options'
import Icon from './Icon'
import LanguageToggle from './LanguageToggle'

export default function SiteLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  // Coming back from the dashboard: use the visitor's site language again.
  useEffect(() => {
    i18n.changeLanguage(storedLanguage('site'))
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const nav = [
    ['/', t('site.nav.home')],
    ['/services', t('site.nav.services')],
    ['/our-work', t('site.nav.ourWork')],
  ] as const

  return (
    <>
      <a href="#main" className="sr-only">
        {t('common.skipToContent')}
      </a>
      <header className="site-head">
        <div className="wrap">
          <Link className="logo" to="/">
            <span>
              <b>JLP</b> Construction
            </span>
          </Link>
          <nav className="nav" aria-label={t('site.nav.home')}>
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to} end>
                {label}
              </NavLink>
            ))}
          </nav>
          <LanguageToggle scope="site" />
          <Link className="btn btn-primary btn-sm" to="/request">
            <Icon name="cal" size={18} />
            <span className="cta-long">{t('site.cta')}</span>
            <span className="cta-short">{t('site.ctaShort')}</span>
          </Link>
        </div>
        <nav className="mobile-nav" aria-label={t('site.nav.home')}>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-foot">
        <div className="wrap">
          <div>
            <strong>JLP Construction LLC</strong>
            <br />
            {t('site.footer.about1')}
            <br />
            {t('site.footer.about2')}
            <br />
            <strong>{t('site.footer.spanish')}</strong>
          </div>
          <div>
            <strong>{t('site.footer.contact')}</strong>
            <br />
            <a className="foot-tel" href={PHONE.tel}>
              {PHONE.display}
            </a>
            <br />
            {t('site.footer.hours')}
          </div>
          <div>
            <strong>{t('site.footer.referrals')}</strong>
            <br />
            {t('site.footer.thanks')}
            <br />
            <a href="https://www.facebook.com/p/JLP-Construction-LLC-100070706625887/">{t('site.footer.facebook')}</a>
            <br />© {new Date().getFullYear()} JLP Construction LLC
            <ul className="inline-list">
              <li>
                <Link to="/policies">{t('site.footer.privacy')}</Link>
              </li>
              <li>
                <Link to="/policies">{t('site.footer.terms')}</Link>
              </li>
              <li>
                <Link to="/policies">{t('site.footer.accessibility')}</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
      {pathname !== '/request' && (
        <div className="call-bar">
          <Link className="btn btn-primary" to="/request">
            {t('site.cta')}
          </Link>
        </div>
      )}
    </>
  )
}
