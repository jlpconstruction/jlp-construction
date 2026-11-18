import { useEffect, useRef } from 'react'

// Cloudflare Turnstile: the free "not a robot" check. Usually invisible; sometimes one click.
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<void> | null = null
function loadScript() {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('turnstile failed to load'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Calls onToken with a one-time token when the check passes, and with '' when it expires or fails.
 *  To run the check again (tokens work once), give the component a new `key`. */
export default function Turnstile({ lang, onToken }: { lang: string; onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !box.current) return
    let id: string | undefined
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: lang === 'es' ? 'es' : 'en',
          theme: 'light',
          size: 'flexible',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => onToken(''))
    return () => {
      cancelled = true
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [siteKey, lang, onToken])

  return <div ref={box} className="turnstile" />
}
