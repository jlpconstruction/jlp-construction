import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../components/Icon'
import { fmtDate, money } from '../../lib/time'
import { PAY_METHODS, paymentSummary, STAGES, todayChicago, type PaymentRow, type PayMethod } from '../../lib/payments'

type Props = {
  total: number | null
  payments: PaymentRow[]
  busy: boolean
  onSetTotal: (amount: number) => void
  onMarkPaid: (p: { stage: 1 | 2 | 3; amount: number; method: PayMethod; paid_on: string }) => void
  onUndo: (stage: 1 | 2 | 3) => void
}

const toNumber = (s: string) => Number(s.replace(/[^\d.]/g, ''))

/** The 35/35/30 payments for an accepted job, inside the request page's "Next step" card. */
export default function PaymentsTracker({ total, payments, busy, onSetTotal, onMarkPaid, onUndo }: Props) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const [editTotal, setEditTotal] = useState(false)
  const [totalText, setTotalText] = useState('')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todayChicago())
  const [method, setMethod] = useState<PayMethod | ''>('')

  const saveTotal = (e: FormEvent) => {
    e.preventDefault()
    const n = toNumber(totalText)
    if (n > 0) {
      onSetTotal(n)
      setEditTotal(false)
      setTotalText('')
    }
  }

  const totalForm = (
    <form className="field" onSubmit={saveTotal} style={{ marginTop: 4 }}>
      <label htmlFor="job-total">{t('admin.pay.totalLabel')}</label>
      <div className="hrow">
        <input
          id="job-total"
          className="input"
          inputMode="decimal"
          value={totalText}
          onChange={(e) => setTotalText(e.target.value)}
          placeholder={total ? String(total) : '12,500'}
        />
        <button className="btn btn-dark" disabled={busy || !totalText}>
          {t('admin.pay.totalSave')}
        </button>
      </div>
    </form>
  )

  if (!total) return totalForm

  const s = paymentSummary(total, payments)

  const submitPaid = (e: FormEvent) => {
    e.preventDefault()
    if (!s.next || !method) return
    const n = amount ? toNumber(amount) : s.nextAmount
    onMarkPaid({ stage: s.next.stage, amount: n, method, paid_on: paidOn })
    setAmount('')
    setMethod('')
    setPaidOn(todayChicago())
  }

  return (
    <div className="pay-track">
      <p className="pay-sum">
        <strong>{t('admin.pay.paidOf', { paid: money(s.paid), total: money(total) })}</strong>
        {s.left > 0 && <span>{t('admin.pay.left', { left: money(s.left) })}</span>}
      </p>
      <div className="pay-bar" aria-hidden="true">
        {STAGES.map((st) => (
          <span key={st.stage} className={s.byStage.has(st.stage) ? 'on' : ''} style={{ flex: st.pct }} />
        ))}
      </div>

      <ol className="pay-list">
        {STAGES.map((st) => {
          const p = s.byStage.get(st.stage)
          const isNext = s.next?.stage === st.stage
          return (
            <li key={st.stage} className={p ? 'paid' : isNext ? 'next' : ''}>
              <div className="pay-row">
                <span className="pay-ico" aria-hidden="true">
                  {p ? <Icon name="check" size={16} /> : st.stage}
                </span>
                <span className="grow">
                  <span className="pay-name">{t(`admin.pay.stage.${st.stage}`, { pct: st.pct })}</span>
                  <span className="pay-meta">
                    {p
                      ? t('admin.pay.paidLine', {
                          amount: money(Number(p.amount)),
                          date: fmtDate(p.paid_on + 'T12:00:00', lng),
                          method: t(`admin.pay.methods.${p.method}`),
                        })
                      : t('admin.pay.dueLine', { amount: money(s.due[st.stage - 1]) })}
                  </span>
                </span>
                {p && (
                  <button
                    type="button"
                    className="link small"
                    disabled={busy}
                    onClick={() => confirm(t('admin.pay.undoConfirm', { n: st.stage })) && onUndo(st.stage)}
                  >
                    {t('admin.pay.undo')}
                  </button>
                )}
              </div>

              {isNext && (
                <form className="pay-form" onSubmit={submitPaid}>
                  <div className="field">
                    <label htmlFor="pay-amount">{t('admin.pay.amount')}</label>
                    <input
                      id="pay-amount"
                      className="input"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={String(s.nextAmount)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pay-date">{t('admin.pay.date')}</label>
                    <input id="pay-date" className="input" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="pay-method">{t('admin.pay.method')}</label>
                    <select id="pay-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} required>
                      <option value="">{t('admin.pay.chooseMethod')}</option>
                      {PAY_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {t(`admin.pay.methods.${m}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-primary" disabled={busy || !method}>
                    <Icon name="check" size={16} /> {t('admin.pay.markPaid')}
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ol>

      {editTotal ? (
        totalForm
      ) : (
        <button type="button" className="link small" onClick={() => setEditTotal(true)}>
          {t('admin.pay.changeTotal')}
        </button>
      )}
    </div>
  )
}
