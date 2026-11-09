import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { useAdmin } from '../../components/AdminLayout'
import { addNote, ApiError, getRequest, updateRequest, type NoteRow, type RequestRow } from '../../lib/api'
import { isOpen, STATUSES, type Status } from '../../lib/options'
import {
  fmtDate,
  fmtDateTime,
  fmtLongDay,
  fmtTime,
  googleCalendarUrl,
  icsUrl,
  money,
  slotsFor,
  upcomingSaturdays,
} from '../../lib/time'
import { fullAddress } from '../../lib/address'
import { LangTag, LoadError, StatusPill, useRoomsText } from './shared'

type MessageKind = 'confirm' | 'info' | 'decline' | 'followup' | 'cancel'
type Detail = { request: RequestRow | null; photoUrls: string[]; notes: NoteRow[] }

const DAY = 86400000
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString()
/** Automatic notes are saved as a small JSON event and shown in Jorge's current language. */
const event = (k: string, params: Record<string, string | number> = {}) => JSON.stringify({ k, ...params })

export default function RequestDetail() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const { requests, reload: reloadList } = useAdmin()
  const rooms = useRoomsText()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null)
  const [slotPick, setSlotPick] = useState('')
  const [quote, setQuote] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    try {
      setDetail(await getRequest(id))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'load_failed')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  if (!detail) return error ? <LoadError error={error} /> : <p className="empty">{t('common.loading')}</p>
  const r = detail.request
  if (!r)
    return (
      <p className="empty">
        {t('admin.detail.notFound')} <Link to="/admin/requests">{t('admin.detail.back')}</Link>
      </p>
    )

  const first = r.name.split(/[\s&]+/)[0]
  const tc = i18n.getFixedT(r.lang) // the client's language, for messages to them
  const clientWhen = r.slot ? `${fmtLongDay(r.slot, r.lang)}, ${fmtTime(r.slot, r.lang)}` : ''
  const textsOk = r.sms_consent && !r.sms_stopped_at

  /** Saves a change, logs it in Notes, and refreshes this page and the lists. */
  const change = async (patch: Partial<RequestRow>, ev?: string, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      await updateRequest(r.id, patch, ev)
      after?.()
      await Promise.all([load(), reloadList()])
      setToast(t('admin.detail.saved'))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'save_failed')
    } finally {
      setBusy(false)
    }
  }

  const openMessage = (kind: MessageKind) => {
    const text = tc(`templates.${kind}`, { first, ref: r.ref, when: clientWhen, address: r.address })
    setMessage({ kind, text })
    setTimeout(() => document.getElementById('msg-text')?.focus(), 30)
  }

  /** After Jorge taps "Text" or "Email" (his own phone/email app opens), log it and move the request along. */
  const messageSent = (via: 'text' | 'email') => {
    if (!message) return
    const { kind } = message
    const patch: Partial<RequestRow> = {}
    if (kind === 'info') Object.assign(patch, { status: 'needs-info', follow_up_due: inDays(2) })
    if (kind === 'decline') Object.assign(patch, { status: 'declined', slot: null })
    if (kind === 'followup') patch.follow_up_due = inDays(3)
    setTimeout(() => change(patch, event(`sent_${via}`, { kind }), () => setMessage(null)), 50)
  }

  // Open Saturday hours for booking or rescheduling
  const taken = new Set(
    (requests ?? []).filter((x) => x.slot && x.status !== 'declined' && x.id !== r.id).map((x) => new Date(x.slot!).getTime()),
  )
  const openSlots = upcomingSaturdays()
    .flatMap(slotsFor)
    .filter((s) => s.getTime() > Date.now() && !taken.has(s.getTime()))

  const book = () => {
    if (!slotPick) return setToast(t('admin.next.pickFirst'))
    change({ status: 'consult', slot: slotPick, follow_up_due: null }, event('booked', { when: slotPick }), () => {
      setSlotPick('')
    }).then(() => openMessageFor('confirm', slotPick))
  }
  // The confirmation needs the new time, before the page reloads
  const openMessageFor = (kind: MessageKind, slot: string) =>
    setMessage({
      kind,
      text: tc(`templates.${kind}`, { first, ref: r.ref, address: r.address, when: `${fmtLongDay(slot, r.lang)}, ${fmtTime(slot, r.lang)}` }),
    })

  const slotPicker = (label: string) => (
    <div className="slot-pick">
      <label className="slot-pick-label" htmlFor="slot-pick">
        {label.replace(/[.…]+$/, '')}
      </label>
      <div className="slot-pick-row">
        <select id="slot-pick" className="input" value={slotPick} onChange={(e) => setSlotPick(e.target.value)}>
          <option value="">{t('admin.next.chooseTime')}</option>
          {openSlots.map((s) => (
            <option key={s.toISOString()} value={s.toISOString()}>
              {fmtDateTime(s, lng)}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-dark" onClick={book} disabled={busy}>
          {t('admin.next.book')}
        </button>
      </div>
    </div>
  )

  const cal = r.slot
    ? {
        start: new Date(r.slot),
        uid: r.id,
        title: t('admin.calendar.title', { name: r.name, rooms: rooms(r) }),
        details: [r.phone, r.email ?? '', '', r.description, '', t('admin.calendar.request', { ref: r.ref })].join('\n'),
        location: fullAddress(r),
      }
    : null

  // The one thing Jorge should do next, based on where the request is
  let next: { title: string; text?: React.ReactNode; actions: React.ReactNode; more?: React.ReactNode; stacked?: boolean }
  const ghost = (label: string, onClick: () => void) => (
    <button type="button" className="btn btn-ghost" onClick={onClick} disabled={busy}>
      {label}
    </button>
  )
  switch (r.status) {
    case 'new':
      next = r.slot
        ? {
            title: t('admin.next.confirmTitle'),
            text: t('admin.next.confirmText', { name: first, when: fmtDateTime(r.slot, lng) }),
            actions: (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => change({ status: 'consult' }, event('confirmed', { when: r.slot! })).then(() => openMessage('confirm'))}
                >
                  <Icon name="check" size={16} /> {t('admin.next.confirm')}
                </button>
                {ghost(t('admin.next.askInfo'), () => openMessage('info'))}
                {ghost(t('admin.next.notFit'), () => openMessage('decline'))}
              </>
            ),
            more: slotPicker(t('admin.next.otherTime')),
          }
        : {
            title: t('admin.next.bookTitle'),
            text: t('admin.next.bookText'),
            actions: (
              <>
                {ghost(t('admin.next.askInfo'), () => openMessage('info'))}
                {ghost(t('admin.next.notFit'), () => openMessage('decline'))}
              </>
            ),
            more: slotPicker(t('admin.next.chooseTime')),
          }
      break
    case 'needs-info':
      next = {
        title: t('admin.next.waitingTitle'),
        text: t('admin.next.waitingText'),
        actions: (
          <>
            <button type="button" className="btn btn-primary" onClick={() => openMessage('info')}>
              {t('admin.next.remindClient')}
            </button>
            {ghost(t('admin.next.notFit'), () => openMessage('decline'))}
          </>
        ),
        more: slotPicker(t('admin.next.bookAnyway')),
      }
      break
    case 'consult':
      next = {
        stacked: true, // the calendar button gets its own row; the two smaller actions sit below it
        title: t('admin.next.bookedTitle'),
        text: r.slot && (
          <>
            <Icon name="cal" size={16} /> <strong>{fmtDateTime(r.slot, lng)}</strong>
          </>
        ),
        actions: (
          <>
            {cal && (
              <a className="btn btn-primary" target="_blank" rel="noopener noreferrer" href={googleCalendarUrl(cal)}>
                <Icon name="cal" size={16} /> {t('admin.next.addCalendar')}
              </a>
            )}
            {ghost(t('admin.next.sendConfirm'), () => openMessage('confirm'))}
            {ghost(t('admin.next.cancelVisit'), () => {
              const slot = r.slot
              if (!slot || !confirm(t('admin.next.cancelConfirm'))) return
              // Back to New with no time: the Saturday slot is free again, and a note is logged
              change({ status: 'new', slot: null, follow_up_due: null }, event('cancelled', { when: slot })).then(() =>
                openMessageFor('cancel', slot),
              )
            })}
          </>
        ),
        more: (
          <>
            {cal && (
              <p className="small" style={{ margin: '10px 0 0' }}>
                <a download={`${r.ref}.ics`} href={icsUrl(cal)}>
                  {t('admin.next.icsFile')}
                </a>
              </p>
            )}
            <form
              className="field"
              style={{ marginTop: 14 }}
              onSubmit={(e) => {
                e.preventDefault()
                const amount = Number(quote.replace(/[^\d.]/g, ''))
                if (amount > 0)
                  change({ status: 'quoted', quote_amount: amount, follow_up_due: inDays(3) }, event('quoted', { amount }), () => setQuote(''))
              }}
            >
              <label htmlFor="quote">{t('admin.next.quoteLabel')}</label>
              <div className="hrow">
                <input id="quote" className="input" inputMode="decimal" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="12,500" />
                <button className="btn btn-dark" disabled={busy || !quote}>
                  {t('admin.next.quoteSave')}
                </button>
              </div>
            </form>
            {slotPicker(t('admin.next.reschedule'))}
          </>
        ),
      }
      break
    case 'quoted':
      next = {
        title: t('admin.next.quotedTitle'),
        text: t('admin.next.quotedText', { amount: money(r.quote_amount ?? 0) }),
        actions: (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => change({ status: 'won', follow_up_due: null }, event('status', { status: 'won' }))}
            >
              <Icon name="check" size={16} /> {t('admin.next.accepted')}
            </button>
            {ghost(t('admin.next.notAccepted'), () => change({ status: 'declined', follow_up_due: null }, event('status', { status: 'declined' })))}
            {ghost(t('admin.next.followUp'), () => openMessage('followup'))}
          </>
        ),
      }
      break
    case 'won':
      next = {
        title: t('admin.next.wonTitle'),
        text: `${money(r.quote_amount ?? 0)}. ${t('admin.next.wonText')}`,
        actions: null,
      }
      break
    default:
      next = {
        title: t('admin.next.closedTitle'),
        text: t('admin.next.closedText'),
        actions: ghost(t('admin.next.reopen'), () => change({ status: 'new' }, event('status', { status: 'new' }))),
      }
  }

  const noteText = (n: NoteRow) => {
    if (n.body) return n.body
    try {
      const { k, ...p } = JSON.parse(n.event ?? '{}')
      const params: Record<string, string> = {}
      if (p.status) params.status = t(`options.status.${p.status}`)
      if (p.when) params.when = fmtDateTime(p.when, lng)
      if (p.amount) params.amount = money(p.amount)
      if (p.kind) params.kind = t(`admin.events.kinds.${p.kind}`)
      if (p.date) params.date = fmtDate(p.date, lng)
      return t(`admin.events.${k}`, params)
    } catch {
      return n.event
    }
  }

  const submitNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    try {
      await addNote(r.id, { body: note.trim() })
      setNote('')
      load()
    } catch {
      setError('save_failed')
    }
  }

  const phoneDigits = r.phone.replace(/[^\d+]/g, '')
  const services = r.services
    .map((s) => (s === 'other' && r.other_service ? `${t('options.services.other.name')}: ${r.other_service}` : t(`options.services.${s}.name`)))
    .join(', ')

  return (
    <>
      <div className="main-head">
        <div>
          <Link to="/admin/requests" className="small muted" style={{ textDecoration: 'none' }}>
            {t('admin.detail.back')}
          </Link>
          <h1 style={{ marginTop: 6 }}>
            {r.name} <LangTag lang={r.lang} />
          </h1>
          <a
            className="addr-link"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(r))}`}
            aria-label={t('admin.detail.directionsTo', { address: fullAddress(r) })}
          >
            <Icon name="pin" size={22} />
            <span>{fullAddress(r)}</span>
          </a>
          <p className="hrow wraps">
            <span>{rooms(r)}</span>
            <StatusPill status={r.status} />
          </p>
        </div>
        <div className="actions">
          <a className="btn btn-ghost btn-sm" href={`tel:${phoneDigits}`}>
            <Icon name="phone" size={16} /> {t('common.call')}
          </a>
        </div>
      </div>

      <section className="ai-soon" aria-label={t('admin.detail.aiSoon')}>
        <div className="ai-tag">
          <Icon name="spark" size={15} /> {t('admin.detail.aiSoon')}
        </div>
        <p className="small" style={{ margin: '6px 0 0' }}>
          {t('admin.detail.aiSoonText')}
        </p>
      </section>

      <LoadError error={error} />

      <div className="detail">
        <div className="stack">
          <section className="panel next" aria-labelledby="next-title">
            <div className="body">
              <div className="tag">{t('admin.detail.nextStep')}</div>
              <h2 id="next-title" style={{ fontSize: 20, margin: '4px 0 6px' }}>
                {next.title}
              </h2>
              {next.text && <p style={{ margin: '0 0 14px' }}>{next.text}</p>}
              {next.actions && <div className={`next-actions${next.stacked ? ' stacked' : ''}`}>{next.actions}</div>}
              {next.more}
              {message && (
                <div className="msg-draft">
                  <label htmlFor="msg-text" className="small" style={{ fontWeight: 600, display: 'block' }}>
                    {t('admin.message.label')}
                  </label>
                  <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                    {t('admin.message.inLang')} ({r.lang === 'es' ? 'Español' : 'English'})
                  </p>
                  <textarea
                    id="msg-text"
                    className="input"
                    lang={r.lang}
                    rows={6}
                    value={message.text}
                    onChange={(e) => setMessage({ ...message, text: e.target.value })}
                  />
                  {!textsOk && <p className="small muted">{t('admin.message.noTexts')}</p>}
                  <div className="actions" style={{ marginTop: 10 }}>
                    {textsOk && (
                      <a className="btn btn-primary btn-sm" href={`sms:${phoneDigits}?&body=${encodeURIComponent(message.text)}`} onClick={() => messageSent('text')}>
                        <Icon name="phone" size={15} /> {t('admin.message.sendText')}
                      </a>
                    )}
                    {r.email && (
                      <a
                        className={`btn btn-sm ${textsOk ? 'btn-ghost' : 'btn-primary'}`}
                        href={`mailto:${r.email}?subject=${encodeURIComponent(tc('templates.subject', { ref: r.ref }))}&body=${encodeURIComponent(message.text)}`}
                        onClick={() => messageSent('email')}
                      >
                        {t('admin.message.sendEmail')}
                      </a>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMessage(null)}>
                      {t('admin.message.close')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>
              {t('admin.detail.photos')} <span className="count">{detail.photoUrls.length}</span>
            </h2>
            <div className="body">
              {detail.photoUrls.length ? (
                <div className="gallery">
                  {detail.photoUrls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={t('admin.detail.photoAlt', { n: i + 1 })} />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>
                  {t('admin.detail.noPhotos')}{' '}
                  {isOpen(r.status) && (
                    <button type="button" className="link" onClick={() => openMessage('info')}>
                      {t('admin.next.askInfo')}
                    </button>
                  )}
                </p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>{t('admin.detail.project')}</h2>
            <div className="body">
              <p style={{ whiteSpace: 'pre-wrap' }} lang={r.lang}>
                {r.description}
              </p>
              <div className="facts">
                <span>{services}</span>
                <span>{t(`options.sizeShort.${r.size}`)}</span>
                <span>{(t('options.budgets', { returnObjects: true }) as string[])[r.budget]}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          <details className="panel more">
            <summary>
              <span className="more-ico" aria-hidden="true">
                <Icon name="info" size={22} />
              </span>
              <span className="more-text">
                <span className="more-title">{t('admin.detail.moreInfo')}</span>
                <span className="more-hint">{t('admin.detail.moreInfoHint')}</span>
              </span>
              <span className="more-chev" aria-hidden="true">
                <Icon name="chevron" size={22} />
              </span>
            </summary>
            <div className="body">
              <dl className="kv">
                <dt>{t('admin.detail.contact')}</dt>
                <dd>
                  {r.phone}
                  {r.email && (
                    <>
                      <br />
                      {r.email}
                    </>
                  )}
                  <br />
                  <span className="muted">
                    {t('admin.detail.prefers', { via: t(`options.contact.${r.contact_pref}`) })}, {r.lang === 'es' ? 'Español' : 'English'}
                  </span>
                </dd>
                <dt>{t('admin.detail.texts')}</dt>
                <dd>
                  {textsOk ? (
                    <>
                      {r.sms_consent_at && t('admin.detail.textsAgreed', { date: fmtDate(r.sms_consent_at, lng) })}{' '}
                      <button
                        type="button"
                        className="btn btn-ghost btn-mini"
                        onClick={() => {
                          if (confirm(t('admin.detail.markStopConfirm')))
                            change({ sms_stopped_at: new Date().toISOString(), contact_pref: 'email' }, event('sms_stop'))
                        }}
                      >
                        {t('admin.detail.markStop')}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="pill st-declined">{t('admin.detail.textsStopped')}</span>{' '}
                      <button
                        type="button"
                        className="btn btn-ghost btn-mini"
                        onClick={() => change({ sms_stopped_at: null, sms_consent: true, contact_pref: 'text' }, event('sms_start'))}
                      >
                        {t('admin.detail.markStart')}
                      </button>
                    </>
                  )}
                </dd>
                <dt>{t('admin.detail.featuring')}</dt>
                <dd>
                  {r.no_feature ? t('admin.detail.featureNo') : t('admin.detail.featureOk')}{' '}
                  <button
                    type="button"
                    className="btn btn-ghost btn-mini"
                    onClick={() => change({ no_feature: !r.no_feature }, event(r.no_feature ? 'feature_ok' : 'feature_no'))}
                  >
                    {t('admin.detail.change')}
                  </button>
                </dd>
                <dt>{t('admin.detail.request')}</dt>
                <dd>
                  {r.ref}
                  <br />
                  {fmtDateTime(r.created_at, lng)}
                </dd>
              </dl>
              <div className="small" style={{ fontWeight: 600, margin: '14px 0 6px' }}>
                {t('admin.detail.statusByHand')}
              </div>
              <div className="chips">
                {STATUSES.map((s: Status) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    aria-pressed={r.status === s}
                    disabled={busy}
                    onClick={() => r.status !== s && change({ status: s, ...(s === 'declined' ? { slot: null } : {}) }, event('status', { status: s }))}
                  >
                    {t(`options.status.${s}`)}
                  </button>
                ))}
              </div>
              <div className="actions mt">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const due = inDays(2)
                    change({ follow_up_due: due }, event('followup_set', { date: due }))
                  }}
                >
                  {t('admin.detail.remind')}
                </button>
              </div>
            </div>
          </details>

          <details className="panel more" open={detail.notes.length > 0}>
            <summary>
              <span className="more-ico" aria-hidden="true">
                <Icon name="note" size={22} />
              </span>
              <span className="more-text">
                <span className="more-title">
                  {t('admin.detail.notes')} <span className="count">{detail.notes.length}</span>
                </span>
                <span className="more-hint">{t('admin.detail.notesHint')}</span>
              </span>
              <span className="more-chev" aria-hidden="true">
                <Icon name="chevron" size={22} />
              </span>
            </summary>
            <div className="body">
              {detail.notes.length ? (
                [...detail.notes].reverse().map((n) => (
                  <div key={n.id} className="note">
                    <small>{fmtDateTime(n.created_at, lng)}</small>
                    {noteText(n)}
                  </div>
                ))
              ) : (
                <p className="muted small" style={{ marginTop: 0 }}>
                  {t('admin.detail.noNotes')}
                </p>
              )}
              <form className="hrow mt" onSubmit={submitNote}>
                <input
                  className="input"
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('admin.detail.notePlaceholder')}
                  aria-label={t('admin.detail.noteLabel')}
                />
                <button className="btn btn-dark btn-sm">{t('admin.detail.add')}</button>
              </form>
            </div>
          </details>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
