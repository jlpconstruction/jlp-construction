import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { ApiError, generateBrief, type Brief, type RequestRow } from '../../lib/api'
import { isOpen } from '../../lib/options'
import { fmtDateTime } from '../../lib/time'

const LISTS = ['trabajo_probable', 'en_las_fotos', 'preguntas', 'llevar', 'alertas'] as const
const ERRORS = ['ai_failed', 'not_admin', 'not_configured', 'not_found']

/**
 * The AI project brief on Jorge's request page. The first time an open request is viewed,
 * it asks Claude to write one (no button needed); after that it shows the saved brief.
 * The brief itself is always in Spanish (Jorge's language); the labels follow the dashboard.
 */
export default function ProjectBrief({ request: r, onSaved }: { request: RequestRow; onSaved: (brief: Brief, at: string) => void }) {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const started = useRef('')

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const { brief, at } = await generateBrief(r.id)
      onSaved(brief, at)
    } catch (e) {
      const key = e instanceof ApiError ? e.message : 'ai_failed'
      setError(ERRORS.includes(key) ? key : 'ai_failed')
    } finally {
      setBusy(false)
    }
  }

  // Automatic: write the brief the first time an open request without one is opened
  useEffect(() => {
    if (r.ai_brief || !isOpen(r.status) || started.current === r.id) return
    started.current = r.id
    run()
  }, [r.id, r.ai_brief, r.status])

  const b = r.ai_brief
  return (
    <section className="brief" aria-labelledby="brief-title" aria-busy={busy}>
      <div className="brief-head">
        <h2 id="brief-title" className="ai-tag">
          <Icon name="spark" size={16} /> {t('admin.brief.title')}
        </h2>
        {b && !busy && (
          <button type="button" className="link small" onClick={run}>
            {t('admin.brief.again')}
          </button>
        )}
      </div>

      {busy && (
        <p className="small" role="status" style={{ margin: '8px 0 0' }}>
          {t('admin.brief.working')}
        </p>
      )}
      {error && !busy && (
        <div role="alert" style={{ marginTop: 8 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>
            {t(`admin.brief.err.${error}`)}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={run}>
            {t('admin.brief.retry')}
          </button>
        </div>
      )}
      {!b && !busy && !error && (
        <div style={{ marginTop: 8 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>
            {t('admin.brief.closed')}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={run}>
            {t('admin.brief.make')}
          </button>
        </div>
      )}

      {b && !busy && (
        <div lang="es">
          <p className={`verdict v-${b.veredicto}`}>
            <strong>{t(`admin.brief.verdict.${b.veredicto}`)}</strong>
            <span>{b.razon}</span>
          </p>
          <p style={{ margin: '0 0 4px' }}>{b.resumen}</p>
          {LISTS.map((k) =>
            b[k].length ? (
              <div key={k} className={k === 'alertas' ? 'brief-list warn' : 'brief-list'}>
                <h3>{t(`admin.brief.lists.${k}`)}</h3>
                <ul>
                  {b[k].map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {b.descripcion_es && (
            <div className="brief-list">
              <h3>{t('admin.brief.translated')}</h3>
              <p className="brief-quote">{b.descripcion_es}</p>
            </div>
          )}
          <p className="tiny muted" style={{ margin: '12px 0 0' }}>
            {t('admin.brief.footer', {
              when: r.ai_brief_at ? fmtDateTime(r.ai_brief_at, i18n.language) : '',
              count: b.photos,
            })}
          </p>
        </div>
      )}
    </section>
  )
}
