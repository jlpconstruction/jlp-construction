import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAdmin } from '../../components/AdminLayout'
import { fmtLongDay, fmtTime, slotsFor, upcomingSaturdays, ymdDate } from '../../lib/time'
import { LoadError, useRoomsText } from './shared'

export default function Saturdays() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const { requests, error } = useAdmin()
  const rooms = useRoomsText()
  const booked = (requests ?? []).filter((r) => r.slot && r.status !== 'declined')
  const days = upcomingSaturdays(4, new Date(Date.now() - 86400000))

  return (
    <>
      <div className="main-head">
        <div>
          <h1>{t('admin.saturdays.title')}</h1>
          <p>{t('admin.saturdays.lead')}</p>
        </div>
      </div>
      <LoadError error={error} />
      <div className="sats">
        {days.map((day, i) => {
          const slots = slotsFor(day)
          const taken = slots.filter((s) => booked.some((r) => new Date(r.slot!).getTime() === s.getTime())).length
          return (
            <section key={`${day.m}-${day.d}`} className={`day ${i === 0 ? 'first' : ''}`}>
              <header>
                <h2 style={{ fontSize: 14, margin: 0 }}>{fmtLongDay(ymdDate(day), lng)}</h2>
                <small>{t('admin.saturdays.summary', { booked: taken, open: slots.length - taken })}</small>
              </header>
              <div className="evs">
                {slots.map((s) => {
                  const r = booked.find((x) => new Date(x.slot!).getTime() === s.getTime())
                  return r ? (
                    <Link key={s.toISOString()} className={`ev ${r.status === 'new' ? 'requested' : ''}`} to={`/admin/requests/${r.id}`}>
                      <b>
                        {fmtTime(s, lng)}, {r.name.split(/\s+/)[0]}
                      </b>
                      <span>
                        {r.address}, {r.city}
                      </span>
                      <br />
                      <span>{rooms(r)}</span>
                      {r.status === 'new' && (
                        <>
                          <br />
                          <span>{t('admin.saturdays.needsConfirm')}</span>
                        </>
                      )}
                    </Link>
                  ) : (
                    <div key={s.toISOString()} className="ev open small">
                      {fmtTime(s, lng)}, {t('admin.saturdays.open')}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <p className="small muted mt">
        <span className="pill confirmed">
          {t('admin.saturdays.legendConfirmed')}
        </span>{' '}
        <span className="pill requested">
          {t('admin.saturdays.legendRequested')}
        </span>
      </p>
    </>
  )
}
