import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { useAdmin } from '../../components/AdminLayout'
import { isOpen } from '../../lib/options'
import { chicagoHour, fmtDate, fmtDateTime, fmtLongDay, fmtTime, sameDay, upcomingSaturdays, ymdDate } from '../../lib/time'
import { initials, LoadError, RequestItem } from './shared'

/** "Today": a short to-do list instead of stats. */
export default function Today() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const { requests, error } = useAdmin()

  if (!requests) return error ? <LoadError error={error} /> : <p className="empty">{t('common.loading')}</p>

  const hour = chicagoHour()
  const greet = hour < 12 ? t('admin.today.morning') : hour < 19 ? t('admin.today.afternoon') : t('admin.today.evening')
  const nextSat = upcomingSaturdays(1, new Date(Date.now() - 86400000))[0] // includes today if it's Saturday

  const answer = requests.filter((r) => r.status === 'new')
  const saturday = requests
    .filter((r) => r.status === 'consult' && r.slot && sameDay(r.slot, nextSat))
    .sort((a, b) => a.slot!.localeCompare(b.slot!))
  const followUp = requests.filter(
    (r) => isOpen(r.status) && r.status !== 'new' && r.follow_up_due && new Date(r.follow_up_due).getTime() <= Date.now() + 86400000,
  )
  const allClear = !answer.length && !saturday.length && !followUp.length

  const panel = (title: string, sub: string, count: number, children: React.ReactNode, empty: string) => (
    <section className="panel">
      <h2>
        {title} <span className="count">{count}</span>
      </h2>
      {sub && (
        <p className="small muted" style={{ margin: 0, padding: '10px 18px 0' }}>
          {sub}
        </p>
      )}
      <div className="list">{count ? children : <div className="empty">{empty}</div>}</div>
    </section>
  )

  const directions = (address: string, city: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${city}`)}`

  return (
    <>
      <div className="main-head">
        <div>
          <h1>{greet}</h1>
          <p>
            {fmtDate(new Date(), lng)}
            <br />
            {allClear ? t('admin.today.caughtUp') : t('admin.today.todo')}
          </p>
        </div>
      </div>
      <LoadError error={error} />
      <div className="today-grid">
        {panel(
          t('admin.today.answer'),
          '',
          answer.length,
          answer.map((r) => <RequestItem key={r.id} r={r} extra={r.slot ? t('admin.today.wants', { when: fmtDateTime(r.slot, lng) }) : ''} />),
          t('admin.today.answerEmpty'),
        )}
        {panel(
          t('admin.today.saturday'),
          fmtLongDay(ymdDate(nextSat), lng),
          saturday.length,
          saturday.map((r) => (
            <div key={r.id} className="item">
              <div className="av cal">
                <Icon name="cal" size={18} />
              </div>
              <div className="grow">
                <div className="t">
                  {fmtTime(r.slot!, lng)}, {r.name}
                </div>
                <div className="s">
                  {r.address}, {r.city}
                </div>
              </div>
              <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={directions(r.address, r.city)}>
                {t('common.directions')}
              </a>
              <Link className="btn btn-dark btn-sm" to={`/admin/requests/${r.id}`}>
                {t('common.open')}
              </Link>
            </div>
          )),
          t('admin.today.saturdayEmpty'),
        )}
        {panel(
          t('admin.today.followUp'),
          t('admin.today.followUpSub'),
          followUp.length,
          followUp.map((r) => (
            <Link key={r.id} className="item" to={`/admin/requests/${r.id}`}>
              <div className="av">{initials(r.name)}</div>
              <div className="grow">
                <div className="t">{r.name}</div>
                <div className="s">{r.status === 'quoted' ? t('admin.today.waitingQuote') : t('admin.today.waitingInfo')}</div>
              </div>
            </Link>
          )),
          t('admin.today.followUpEmpty'),
        )}
        <section className="panel">
          <div className="body small muted">{t('admin.today.payments')}</div>
        </section>
      </div>
    </>
  )
}
