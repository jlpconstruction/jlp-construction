import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import AddressField from '../../components/AddressField'
import Icon from '../../components/Icon'
import Turnstile from '../../components/Turnstile'
import { ApiError, fetchTakenSlots, submitRequest } from '../../lib/api'
import {
  BUDGET_ORDER,
  CONTACT_PREFS,
  ROOM_ICON,
  ROOMS,
  SERVICES,
  SIZES,
  type ContactPref,
  type Room,
  type Service,
  type Size,
} from '../../lib/options'
import { fullAddress, STATES, type StateCode } from '../../lib/address'
import { MAX_PHOTOS, preparePhoto, type PreparedPhoto } from '../../lib/photos'
import { fmtDateTime, fmtLongDay, fmtTime, slotsFor, upcomingSaturdays, ymdDate } from '../../lib/time'

type Form = {
  rooms: Room[]
  services: Service[]
  otherService: string
  description: string
  size: Size | ''
  budget: string // '' until chosen, then a key from BUDGET_ORDER
  photos: PreparedPhoto[]
  name: string
  phone: string
  email: string
  contactPref: ContactPref
  address: string
  city: string
  state: StateCode
  zip: string
  slot: string
  smsConsent: boolean
}

const emptyForm = (service?: string | null): Form => ({
  rooms: [],
  services: SERVICES.includes(service as never) ? [service as Service] : [],
  otherService: '',
  description: '',
  size: '',
  budget: '',
  photos: [],
  name: '',
  phone: '',
  email: '',
  contactPref: 'text',
  address: '',
  city: '',
  state: 'IL',
  zip: '',
  slot: '',
  smsConsent: false, // unchecked by default; the customer has to check it
})

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

/** Returns the translation key of the first problem on this step, or '' if it's fine. */
function validate(step: number, f: Form, hasSlots: boolean): string {
  if (step === 1 && !f.rooms.length) return 'form.err.rooms'
  if (step === 2) {
    if (!f.services.length) return 'form.err.services'
    if (f.description.trim().length < 10) return 'form.err.description'
    if (!f.size) return 'form.err.size'
    if (f.budget === '') return 'form.err.budget'
  }
  if (step === 4) {
    if (!f.name.trim()) return 'form.err.name'
    if (f.phone.replace(/\D/g, '').length < 10) return 'form.err.phone'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'form.err.email'
    if (!/\d/.test(f.address) || !f.city.trim()) return 'form.err.address'
    if (!/^\d{5}$/.test(f.zip.trim())) return 'form.err.zip'
    if (!f.slot && hasSlots) return 'form.err.slot'
    if (!f.smsConsent) return 'form.err.consent'
  }
  return ''
}

export default function RequestForm() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const [params] = useSearchParams()
  const [form, setForm] = useState<Form>(() => emptyForm(params.get('service')))
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [taken, setTaken] = useState<Set<number> | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ ref: string; name: string; via: ContactPref; slot: string; email: string } | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [captcha, setCaptcha] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const onCaptcha = useCallback((token: string) => setCaptcha(token), [])
  const needCaptcha = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const loadSlots = () =>
    fetchTakenSlots()
      .then(setTaken)
      .catch(() => setTaken(new Set()))

  useEffect(() => {
    if (step === 4) loadSlots()
  }, [step])

  // Move focus to the step title so screen readers announce the new step.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step, done])

  const saturdays = upcomingSaturdays().map((day) => ({
    day,
    slots: slotsFor(day).filter((s) => s.getTime() > Date.now() && !taken?.has(s.getTime())),
  }))
  const hasSlots = saturdays.some((d) => d.slots.length > 0)

  const next = () => {
    const err = validate(step, form, hasSlots)
    setError(err)
    if (!err) {
      setStep(step + 1)
      window.scrollTo(0, 0)
    }
  }
  const back = () => {
    setError('')
    setStep(step - 1)
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    const room = MAX_PHOTOS - form.photos.length
    const prepared: PreparedPhoto[] = []
    for (const file of [...files].filter((f) => f.type.startsWith('image/')).slice(0, room)) {
      try {
        prepared.push(await preparePhoto(file))
      } catch {
        // skip files the browser can't read (e.g. some HEIC photos on Windows)
      }
    }
    setForm((f) => ({ ...f, photos: [...f.photos, ...prepared] }))
    setBusy(false)
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const ref = await submitRequest(
        {
          lang: lng === 'es' ? 'es' : 'en',
          rooms: form.rooms,
          services: form.services,
          other_service: form.otherService,
          description: form.description.trim(),
          size: form.size as Size,
          budget: Number(form.budget),
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          contact_pref: form.contactPref,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          zip: form.zip.trim(),
          slot: form.slot,
          sms_consent: form.smsConsent,
          sms_consent_text: t('form.smsConsent'), // exact wording they agreed to, in their language
          no_feature: false, // a client who'd rather not be featured tells Jorge; he records it on the request page
        },
        form.photos.map((p) => p.blob),
        captcha,
      )
      setDone({ ref, name: form.name.trim().split(/\s+/)[0], via: form.contactPref, slot: form.slot, email: form.email.trim() })
      form.photos.forEach((p) => URL.revokeObjectURL(p.url))
      window.scrollTo(0, 0)
    } catch (e) {
      const key = e instanceof ApiError ? e.message : 'submit_failed'
      setCaptcha('')
      setCaptchaKey((k) => k + 1) // each check works once
      setError(`errors.${key}`)
      if (key === 'slot_taken' || key === 'invalid_slot') {
        set('slot', '')
        setStep(4)
        loadSlots()
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="sect">
        <div className="wrap">
          <div className="wizard card success">
            <div className="big">
              <Icon name="check" size={36} />
            </div>
            <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 30 }}>
              {t('form.done.title')}
            </h1>
            <p className="muted">
              {t('form.done.text', { name: done.name, ref: done.ref })}
              <br />
              {t('form.done.next', { via: t(`form.done.via.${done.via}`) })}
            </p>
            {done.slot && <p>{t('form.done.slot', { when: fmtDateTime(done.slot, lng) })}</p>}
            {done.email && <p>{t('form.done.emailSent', { email: done.email })}</p>}
            <div className="actions" style={{ justifyContent: 'center', marginTop: 20 }}>
              <Link className="btn btn-dark" to="/">
                {t('form.done.home')}
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setForm(emptyForm())
                  setStep(1)
                  setDone(null)
                }}
              >
                {t('form.done.another')}
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const titles = t('form.titles', { returnObjects: true }) as string[]
  const budgets = t('options.budgets', { returnObjects: true }) as string[]
  const serviceList = form.services
    .map((s) => (s === 'other' && form.otherService ? `${t('options.services.other.name')}: ${form.otherService}` : t(`options.services.${s}.name`)))
    .join(', ')

  return (
    <section className="sect" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <div className="wizard">
          <div className="steps" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
          <div className="step-label">{t('form.stepOf', { step })}</div>
          <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 'clamp(26px, 3.6vw, 34px)', marginTop: 4, outline: 'none' }}>
            {titles[step - 1]}
          </h1>

          {step === 1 && (
            <>
              <p className="muted">{t('form.roomsHint')}</p>
              <div className="rooms">
                {ROOMS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="room"
                    aria-pressed={form.rooms.includes(r)}
                    onClick={() => set('rooms', toggle(form.rooms, r))}
                  >
                    <Icon name={ROOM_ICON[r]} size={34} />
                    <strong>{t(`options.rooms.${r}.name`)}</strong>
                    <span>{t(`options.rooms.${r}.hint`)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="field" role="group" aria-labelledby="svc-label">
                <div className="label" id="svc-label">
                  {t('form.servicesLabel')}
                </div>
                <div className="chips">
                  {[...SERVICES, 'other' as const].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip"
                      aria-pressed={form.services.includes(s)}
                      onClick={() => set('services', toggle(form.services, s))}
                    >
                      {s === 'other' && <Icon name="plus" size={14} />} {t(`options.services.${s}.name`)}
                    </button>
                  ))}
                </div>
                {form.services.includes('other') && (
                  <input
                    className="input"
                    style={{ marginTop: 10 }}
                    value={form.otherService}
                    maxLength={200}
                    onChange={(e) => set('otherService', e.target.value)}
                    placeholder={t('form.otherPlaceholder')}
                    aria-label={t('form.otherLabel')}
                  />
                )}
              </div>
              <div className="field">
                <label htmlFor="f-desc">{t('form.descLabel')}</label>
                <textarea
                  id="f-desc"
                  className="input"
                  value={form.description}
                  maxLength={4000}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={t('form.descPlaceholder')}
                  aria-describedby="f-desc-hint"
                />
                <div className="hint" id="f-desc-hint">
                  {t('form.descHint')}
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="f-size">{t('form.sizeLabel')}</label>
                  <select id="f-size" className="input" value={form.size} onChange={(e) => set('size', e.target.value as Size)} required>
                    <option value="">{t('form.select')}</option>
                    {SIZES.map((s) => (
                      <option key={s} value={s}>
                        {t(`options.sizes.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-budget">{t('form.budgetLabel')}</label>
                  <select id="f-budget" className="input" value={form.budget} onChange={(e) => set('budget', e.target.value)} required>
                    <option value="">{t('form.select')}</option>
                    {BUDGET_ORDER.map((i) => (
                      <option key={i} value={i}>
                        {budgets[i]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label className="drop">
                <Icon name="camera" size={36} />
                <span style={{ fontWeight: 600, marginTop: 8 }}>{t('form.photosTap')}</span>
                <span className="small muted">{t('form.photosLimit')}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={busy || form.photos.length >= MAX_PHOTOS}
                  onChange={(e) => {
                    addPhotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
              {busy && <p className="small muted mt" role="status">{t('form.processing')}</p>}
              {form.photos.length > 0 && (
                <div className="thumbs">
                  {form.photos.map((p, i) => (
                    <div key={p.url} className="thumb">
                      <img src={p.url} alt={t('form.photoAlt', { n: i + 1 })} />
                      <button
                        type="button"
                        aria-label={t('form.removePhoto', { n: i + 1 })}
                        onClick={() => {
                          URL.revokeObjectURL(p.url)
                          set('photos', form.photos.filter((x) => x !== p))
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="tips">
                <strong>{t('form.tipsTitle')}</strong>
                <ul>
                  {(t('form.tips', { returnObjects: true }) as string[]).map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              {!form.photos.length && <p className="small muted mt">{t('form.noPhotos')}</p>}
            </>
          )}

          {step === 4 && (
            <>
              <div className="row2">
                <div className="field">
                  <label htmlFor="f-name">{t('form.name')}</label>
                  <input id="f-name" className="input" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} autoComplete="name" required />
                </div>
                <div className="field">
                  <label htmlFor="f-phone">{t('form.phone')}</label>
                  <input id="f-phone" className="input" type="tel" value={form.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" required />
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="f-email">{t('form.email')}</label>
                  <input id="f-email" className="input" type="email" value={form.email} maxLength={200} onChange={(e) => set('email', e.target.value)} autoComplete="email" required />
                </div>
                <div className="field" role="group" aria-labelledby="pref-label">
                  <div className="label" id="pref-label">
                    {t('form.contactPref')}
                  </div>
                  <div className="chips">
                    {CONTACT_PREFS.map((c) => (
                      <button key={c} type="button" className="chip" aria-pressed={form.contactPref === c} onClick={() => set('contactPref', c)}>
                        {t(`options.contact.${c}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="f-addr">{t('form.address')}</label>
                <AddressField
                  value={form.address}
                  onChange={(v) => set('address', v)}
                  onPick={(s) => setForm((f) => ({ ...f, address: s.street, city: s.city, state: s.state, zip: s.zip }))}
                />
              </div>
              <div className="row3">
                <div className="field">
                  <label htmlFor="f-city">{t('form.city')}</label>
                  <input id="f-city" className="input" value={form.city} maxLength={100} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" required />
                </div>
                <div className="field">
                  <label htmlFor="f-state">{t('form.state')}</label>
                  <select id="f-state" className="input" value={form.state} onChange={(e) => set('state', e.target.value as StateCode)} required>
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {t(`options.states.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-zip">{t('form.zip')}</label>
                  <input id="f-zip" className="input" value={form.zip} inputMode="numeric" maxLength={5} onChange={(e) => set('zip', e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" required />
                </div>
              </div>
              <div className="field" role="group" aria-labelledby="slot-label">
                <div className="label" id="slot-label">
                  {t('form.slotLabel')}
                </div>
                <div className="hint" style={{ margin: '0 0 8px' }}>
                  {t('form.slotHint')}
                </div>
                {taken === null ? (
                  <p className="small muted">{t('form.slotsLoading')}</p>
                ) : !hasSlots ? (
                  <p className="notice">{t('form.noSlots')}</p>
                ) : (
                  saturdays
                    .filter((d) => d.slots.length)
                    .map(({ day, slots }) => (
                      <div key={`${day.m}-${day.d}`}>
                        <div className="slot-day">{fmtLongDay(ymdDate(day), lng)}</div>
                        <div className="slots">
                          {slots.map((s) => {
                            const iso = s.toISOString()
                            return (
                              <button
                                key={iso}
                                type="button"
                                className="slot"
                                aria-pressed={form.slot === iso}
                                aria-label={fmtDateTime(s, lng)}
                                onClick={() => set('slot', form.slot === iso ? '' : iso)}
                              >
                                {fmtTime(s, lng)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))
                )}
              </div>
              <label className="check field">
                <input type="checkbox" checked={form.smsConsent} onChange={(e) => set('smsConsent', e.target.checked)} required />
                <span>
                  <strong>{t('form.required')}</strong> {t('form.smsConsent')}
                </span>
              </label>
            </>
          )}

          {step === 5 && (
            <>
              <div className="card review">
                <dl>
                  <dt>{t('form.review.rooms')}</dt>
                  <dd>{form.rooms.map((r) => t(`options.rooms.${r}.name`)).join(', ')}</dd>
                  <dt>{t('form.review.services')}</dt>
                  <dd>{serviceList}</dd>
                  <dt>{t('form.review.description')}</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{form.description}</dd>
                  <dt>{t('form.review.sizeBudget')}</dt>
                  <dd>
                    {form.size && t(`options.sizeShort.${form.size}`)}, {budgets[Number(form.budget)]}
                  </dd>
                  <dt>{t('form.review.photos')}</dt>
                  <dd>
                    {form.photos.length ? (
                      <div className="thumbs" style={{ margin: 0 }}>
                        {form.photos.map((p, i) => (
                          <div key={p.url} className="thumb">
                            <img src={p.url} alt={t('form.photoAlt', { n: i + 1 })} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      t('common.none')
                    )}
                  </dd>
                  <dt>{t('form.review.contact')}</dt>
                  <dd>
                    {form.name}
                    <br />
                    {form.phone}
                    {form.email && (
                      <>
                        <br />
                        {form.email}
                      </>
                    )}
                    <br />
                    {t('form.review.prefers')}: {t(`options.contact.${form.contactPref}`)}
                  </dd>
                  <dt>{t('form.review.address')}</dt>
                  <dd>
                    {fullAddress(form)}
                  </dd>
                  <dt>{t('form.review.consultation')}</dt>
                  <dd>{form.slot ? fmtDateTime(form.slot, lng) : '—'}</dd>
                  <dt>{t('form.review.texts')}</dt>
                  <dd>{t('form.review.textsAgreed')}</dd>
                </dl>
              </div>
              <div className="mt">
                <Turnstile key={`${captchaKey}-${lng}`} lang={lng} onToken={onCaptcha} />
                {needCaptcha && !captcha && <p className="small muted">{t('form.captchaWaiting')}</p>}
              </div>
              <p className="small muted mt">
                {t('form.agree')} <Link to="/policies">{t('site.footer.privacy')}</Link>
              </p>
            </>
          )}

          {error && (
            <div className="err" role="alert">
              {t(error)}
            </div>
          )}

          <div className="wiz-nav">
            {step > 1 ? (
              <button type="button" className="btn btn-ghost" onClick={back} disabled={busy}>
                <Icon name="arrowL" size={18} /> {t('common.back')}
              </button>
            ) : (
              <span />
            )}
            {step < 5 ? (
              <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
                {step === 3 && !form.photos.length ? t('form.skip') : t('common.continue')} <Icon name="arrowR" size={18} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || (needCaptcha && !captcha)}>
                <Icon name="check" size={18} /> {busy ? t('form.submitting') : t('form.submit')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
