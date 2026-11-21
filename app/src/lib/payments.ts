// The 35/35/30 payment plan: 35% the first week, 35% at the halfway point, 30% at completion.
export const STAGES = [
  { stage: 1, pct: 35 },
  { stage: 2, pct: 35 },
  { stage: 3, pct: 30 },
] as const

export const PAY_METHODS = ['cash', 'check', 'zelle', 'card', 'other'] as const
export type PayMethod = (typeof PAY_METHODS)[number]

export type PaymentRow = {
  id: string
  request_id: string
  stage: 1 | 2 | 3
  amount: number
  method: PayMethod
  paid_on: string // YYYY-MM-DD
}

/** What's due at each stage, in whole dollars. The last payment takes the rounding, so they add up to the total. */
export function stageAmounts(total: number): [number, number, number] {
  const first = Math.round(total * 0.35)
  const second = Math.round(total * 0.35)
  return [first, second, Math.round((total - first - second) * 100) / 100]
}

/** Where a job's payments stand. */
export function paymentSummary(total: number, payments: PaymentRow[]) {
  const due = stageAmounts(total)
  const byStage = new Map(payments.map((p) => [p.stage, p]))
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const next = STAGES.find((s) => !byStage.has(s.stage)) ?? null
  return {
    due,
    byStage,
    paid,
    left: Math.max(0, Math.round((total - paid) * 100) / 100),
    next, // the first stage not marked paid yet, or null when all three are in
    nextAmount: next ? due[next.stage - 1] : 0,
  }
}

/** Today's date in Chicago as YYYY-MM-DD (for the "paid on" field). */
export const todayChicago = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
