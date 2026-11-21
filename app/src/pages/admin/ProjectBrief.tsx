import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { ApiError, generateBrief, type Brief, type RequestRow } from '../../lib/api'
import { isOpen } from '../../lib/options'
import { fmtDateTime, money } from '../../lib/time'

const LISTS = ['trabajo_probable', 'en_las_fotos', 'preguntas', 'llevar', 'alertas'] as const
const ERRORS = ['ai_failed', 'not_admin', 'not_configured', 'not_found']

/**
 * The AI project brief on Jorge's request page. The first time an open request is viewed,
 * it asks Claude to write one (no button needed); after that it shows the saved brief.
 * The brief and the whole card are always in Spanish (Jorge's language).
 */
export default function ProjectBrief({ request: r, onSaved }: { request: RequestRow; onSaved: (brief: Brief, at: string) => void }) {
  // The whole card is always in Spanish, like the brief Claude writes, whatever language the dashboard is in
  const { i18n } = useTranslation()
  const t = i18n.getFixedT('es')
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
    <section className="brief" lang="es" aria-labelledby="brief-title" aria-busy={busy}>
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
          {b.estimado && (
            <div className="estimate">
              <h3>{t('admin.brief.estimate')}</h3>
              {b.estimado.disponible ? (
                <>
                  <p className="estimate-range">
                    {money(b.estimado.bajo)} – {money(b.estimado.alto)}
                  </p>
                  {b.estimado.incluye && <p style={{ margin: '4px 0 0' }}>{b.estimado.incluye}</p>}
                  {b.estimado.puede_subir.length > 0 && (
                    <>
                      <p className="estimate-sub">{t('admin.brief.couldRise')}</p>
                      <ul>
                        {b.estimado.puede_subir.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p style={{ margin: '4px 0 0' }}>
                  <strong>{t('admin.brief.noEstimate')}</strong> {b.estimado.falta_saber}
                </p>
              )}
              <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                {t('admin.brief.estimateNote')}
              </p>
            </div>
          )}
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
              when: r.ai_brief_at ? fmtDateTime(r.ai_brief_at, 'es') : '',
              count: b.photos,
            })}
          </p>
        </div>
      )}
    </section>
  )
}
