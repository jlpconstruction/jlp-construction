import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import i18n, { storedLanguage } from '../../i18n'
import LanguageToggle from '../../components/LanguageToggle'
import { supabase } from '../../lib/supabase'

/** Google's multicolor "G" (brand guidelines ask for it on Google sign-in buttons). */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

/**
 * Jorge signs in with his Google account only (no password to guess or leak).
 * 2-step verification is handled by Google. The database still checks that the
 * account is listed in `admins`; anyone else is signed out right away.
 */
export default function Login() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  // Sent back here by Google/Supabase (e.g. sign-ups are off) or by AdminLayout (not an admin)
  const [error, setError] = useState(params.get('denied') || params.get('error') ? 'admin.login.notAdmin' : '')

  useEffect(() => {
    i18n.changeLanguage(storedLanguage('admin'))
  }, [])

  const signIn = async () => {
    if (!supabase) return setError('errors.not_configured')
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin`, queryParams: { prompt: 'select_account' } },
    })
    if (authError) {
      setBusy(false)
      setError('admin.login.failed')
    }
    // On success the browser goes to Google, then comes back to /admin.
  }

  return (
    <main className="login">
      <div className="card">
        <div className="hrow" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
          <LanguageToggle scope="admin" />
        </div>
        <div className="logo" style={{ justifyContent: 'center', marginBottom: 12 }}>
          <span className="logo-mark">JLP</span>
          <span>
            JLP Construction<small>{t('admin.login.title')}</small>
          </span>
        </div>
        <h1 className="sr-only">{t('admin.login.title')}</h1>
        <p className="muted" style={{ textAlign: 'center' }}>
          {t('admin.login.intro')}
        </p>
        {error && (
          <p className="err" role="alert" style={{ textAlign: 'center' }}>
            {t(error)}
          </p>
        )}
        <button type="button" className="btn google-btn" style={{ width: '100%', marginTop: 8 }} onClick={signIn} disabled={busy}>
          <GoogleG /> {busy ? t('common.loading') : t('admin.login.google')}
        </button>
        <p className="small muted" style={{ marginTop: 14, textAlign: 'center' }}>
          <Link to="/">{t('admin.login.backToSite')}</Link>
        </p>
      </div>
    </main>
  )
}
