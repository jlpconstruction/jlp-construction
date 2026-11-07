import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { RequestRow } from '../../lib/api'
import type { Status } from '../../lib/options'
import { timeAgo } from '../../lib/time'

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export function StatusPill({ status }: { status: Status }) {
  const { t } = useTranslation()
  return <span className={`pill st-${status}`}>{t(`options.status.${status}`)}</span>
}

export const LangTag = ({ lang }: { lang: string }) =>
  lang === 'es' ? (
    <span className="pill" title="Español" lang="es">
      ES
    </span>
  ) : null

export function useRoomsText() {
  const { t } = useTranslation()
  return (r: Pick<RequestRow, 'rooms'>, lng?: string) => r.rooms.map((x) => t(`options.rooms.${x}.name`, { lng })).join(', ')
}

export function RequestItem({ r, extra }: { r: RequestRow; extra?: string }) {
  const { i18n } = useTranslation()
  const rooms = useRoomsText()
  return (
    <Link className="item" to={`/admin/requests/${r.id}`}>
      <div className="av">{initials(r.name)}</div>
      <div className="grow">
        <div className="t">
          {r.name} <LangTag lang={r.lang} />
        </div>
        <div className="s">
          {[rooms(r), r.city, extra].filter(Boolean).join(', ')}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <StatusPill status={r.status} />
        <div className="small muted" style={{ marginTop: 4 }}>
          {timeAgo(r.created_at, i18n.language)}
        </div>
      </div>
    </Link>
  )
}

export function LoadError({ error }: { error: string }) {
  const { t } = useTranslation()
  return error ? (
    <p className="notice" role="alert">
      {t(`errors.${error}`)}
    </p>
  ) : null
}
