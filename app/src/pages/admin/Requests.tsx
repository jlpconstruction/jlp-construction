import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdmin } from '../../components/AdminLayout'
import { isOpen } from '../../lib/options'
import { LoadError, RequestItem } from './shared'

export default function Requests() {
  const { t } = useTranslation()
  const { requests, error, reload } = useAdmin()
  const [tab, setTab] = useState<'open' | 'closed'>('open')

  const groups = {
    open: requests?.filter((r) => isOpen(r.status)) ?? [],
    closed: requests?.filter((r) => !isOpen(r.status)) ?? [],
  }

  return (
    <>
      <div className="main-head">
        <div>
          <h1>{t('admin.requests.title')}</h1>
          <p>{t('admin.requests.lead')}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
          {t('admin.requests.refresh')}
        </button>
      </div>
      <LoadError error={error} />
      <div className="tabs">
        {(['open', 'closed'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {t(`admin.requests.${k}`)} <span className={tab === k ? '' : 'muted'}>{groups[k].length}</span>
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="list">
          {!requests ? (
            <div className="empty">{t('common.loading')}</div>
          ) : groups[tab].length ? (
            groups[tab].map((r) => <RequestItem key={r.id} r={r} />)
          ) : (
            <div className="empty">{t('admin.requests.empty')}</div>
          )}
        </div>
      </div>
    </>
  )
}
