import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useOutletContext } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import i18n, { storedLanguage } from '../i18n'
import { supabase } from '../lib/supabase'
import { ApiError, listRequests, type RequestRow } from '../lib/api'
import Icon from './Icon'
import LanguageToggle from './LanguageToggle'

type AdminContext = { requests: RequestRow[] | null; error: string; reload: () => Promise<void> }
export const useAdmin = () => useOutletContext<AdminContext>()

/**
 * Only lets Jorge (a signed-in user listed in `admins`) see the dashboard.
 * Any other Google account is signed out right away.
 */
function useAdminSession() {
  const [state, setState] = useState<'loading' | 'out' | 'denied' | 'in'>('loading')
  useEffect(() => {
    if (!supabase) return setState('out')
    const check = async (session: Session | null) => {
      if (!session) return setState('out')
      const { data } = await supabase!.rpc('is_admin')
      if (data === true) return setState('in')
      await supabase!.auth.signOut()
      setState('denied')
    }
    supabase.auth.getSession().then(({ data }) => check(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setState((s) => (s === 'denied' ? s : 'out'))
    })
    return () => sub.subscription.unsubscribe()
  }, [])
  return state
}

export default function AdminLayout() {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const session = useAdminSession()
  const [requests, setRequests] = useState<RequestRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    i18n.changeLanguage(storedLanguage('admin'))
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const reload = useCallback(async () => {
    try {
      setRequests(await listRequests())
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'load_failed')
    }
  }, [])

  useEffect(() => {
    if (session === 'in') reload()
  }, [session, reload])

  if (session === 'loading') return <p className="empty">{t('common.loading')}</p>
  if (session === 'denied') return <Navigate to="/admin/login?denied=1" replace />
  // Keep ?error=… from Google/Supabase (e.g. an account that isn't allowed) so the login page can explain it
  if (session === 'out') return <Navigate to={`/admin/login${new URLSearchParams(search).has('error') ? search : ''}`} replace />

  const newCount = requests?.filter((r) => r.status === 'new').length ?? 0
  const nav = [
    ['/admin', t('admin.nav.today'), 'check', newCount],
    ['/admin/requests', t('admin.nav.requests'), 'inbox', 0],
    ['/admin/saturdays', t('admin.nav.saturdays'), 'cal', 0],
  ] as const

  return (
    <div className="admin">
      <a href="#main" className="sr-only">
        {t('common.skipToContent')}
      </a>
      <nav className="side" aria-label={t('admin.title')}>
        <Link className="logo" to="/admin">
          <span className="logo-mark alt">JLP</span>
          <span>
            {t('admin.title')}
            <small>Jorge</small>
          </span>
        </Link>
        {nav.map(([to, label, icon, badge]) => (
          <NavLink key={to} to={to} end={to === '/admin'}>
            <Icon name={icon} size={18} /> {label}
            {badge > 0 && <span className="badge">{badge}</span>}
          </NavLink>
        ))}
        <LanguageToggle scope="admin" className="side-item" />
        <button type="button" className="side-item" onClick={() => supabase?.auth.signOut()}>
          <Icon name="logout" size={18} /> {t('admin.signOut')}
        </button>
        <div className="foot">
          <Link to="/">{t('admin.viewSite')}</Link>
        </div>
      </nav>
      <main id="main" className="main">
        <Outlet context={{ requests, error, reload } satisfies AdminContext} />
      </main>
    </div>
  )
}
