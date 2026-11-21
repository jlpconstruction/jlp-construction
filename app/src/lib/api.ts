import { supabase } from './supabase'
import type { ContactPref, Room, Service, Size, Status } from './options'
import type { PaymentRow, PayMethod } from './payments'

export const PHOTO_BUCKET = 'request-photos'

/** `message` is a short error key, translated in the UI (errors.*). */
export class ApiError extends Error {}

function db() {
  if (!supabase) throw new ApiError('not_configured')
  return supabase
}

/* ---------- Public (customer website) ---------- */

export async function fetchTakenSlots(): Promise<Set<number>> {
  const { data, error } = await db().rpc('taken_slots')
  if (error) throw new ApiError('load_failed')
  return new Set((data as string[]).map((s) => new Date(s).getTime()))
}

export type NewRequest = {
  lang: 'en' | 'es'
  rooms: Room[]
  services: Service[]
  other_service: string
  description: string
  size: Size
  budget: number
  name: string
  phone: string
  email: string
  contact_pref: ContactPref
  address: string
  city: string
  state: 'IL' | 'IN'
  zip: string
  slot: string
  sms_consent: boolean
  sms_consent_text: string
  no_feature: boolean
}

/**
 * Sends the request through the submit-request Edge Function, which checks the spam token
 * and saves it, then uploads the photos with the one-time links it returns.
 * Returns the reference number.
 */
export async function submitRequest(req: NewRequest, photos: Blob[], token: string): Promise<string> {
  const client = db()
  const { data, error } = await client.functions.invoke('submit-request', {
    body: { token, request: req, photoCount: photos.length },
  })
  if (error) {
    let key = 'submit_failed'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (typeof body?.error === 'string') key = body.error
    } catch {
      // network error or no JSON body
    }
    throw new ApiError(key)
  }
  const { ref, uploads } = data as { ref: string; uploads: { path: string; token: string }[] }
  // The request is already saved; a photo that fails to upload just won't show on Jorge's page.
  await Promise.all(
    uploads.map((u, i) =>
      photos[i]
        ? client.storage.from(PHOTO_BUCKET).uploadToSignedUrl(u.path, u.token, photos[i], { contentType: 'image/jpeg' })
        : null,
    ),
  )
  return ref
}

/* ---------- Admin (Jorge's dashboard) ---------- */

export type RequestRow = {
  id: string
  ref: string
  created_at: string
  lang: 'en' | 'es'
  name: string
  phone: string
  email: string | null
  contact_pref: ContactPref
  address: string
  city: string
  state: string | null
  zip: string | null
  rooms: Room[]
  services: Service[]
  other_service: string | null
  description: string
  size: Size
  budget: number
  slot: string | null
  status: Status
  quote_amount: number | null
  follow_up_due: string | null
  sms_consent: boolean
  sms_consent_at: string | null
  sms_stopped_at: string | null
  no_feature: boolean
  ai_brief: Brief | null
  ai_brief_at: string | null
}

/** The AI project brief (written in Spanish by the project-brief Edge Function). */
export type Brief = {
  veredicto: 'visitar' | 'pedir_info' | 'no_encaja'
  razon: string
  resumen: string
  trabajo_probable: string[]
  en_las_fotos: string[]
  preguntas: string[]
  llevar: string[]
  alertas: string[]
  descripcion_es: string
  photos: number
}

/** Asks Claude (through the project-brief Edge Function) to write the brief, and saves it. */
export async function generateBrief(id: string): Promise<{ brief: Brief; at: string }> {
  const { data, error } = await db().functions.invoke('project-brief', { body: { id } })
  if (error) {
    let key = 'ai_failed'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (typeof body?.error === 'string') key = body.error
    } catch {
      // network error or no JSON body
    }
    throw new ApiError(key)
  }
  return data as { brief: Brief; at: string }
}

export type NoteRow = { id: string; created_at: string; body: string | null; event: string | null }

export async function listRequests(): Promise<RequestRow[]> {
  const { data, error } = await db().from('requests').select('*').order('created_at', { ascending: false })
  if (error) throw new ApiError('load_failed')
  return data as RequestRow[]
}

export async function getRequest(id: string) {
  const client = db()
  const [req, photos, notes, payments] = await Promise.all([
    client.from('requests').select('*').eq('id', id).maybeSingle(),
    client.from('request_photos').select('storage_path').eq('request_id', id).order('storage_path'),
    client.from('notes').select('id, created_at, body, event').eq('request_id', id).order('created_at'),
    client.from('payments').select('*').eq('request_id', id).order('stage'),
  ])
  if (req.error || photos.error || notes.error) throw new ApiError('load_failed')
  let photoUrls: string[] = []
  const paths = (photos.data ?? []).map((p) => p.storage_path as string)
  if (paths.length) {
    // Private bucket: signed links that expire after 10 minutes
    const { data } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 600)
    photoUrls = (data ?? []).flatMap((x) => (x.signedUrl ? [x.signedUrl] : []))
  }
  return {
    request: req.data as RequestRow | null,
    photoUrls,
    notes: (notes.data ?? []) as NoteRow[],
    // Before migration 007 is run the payments table doesn't exist; the page still loads
    payments: (payments.error ? [] : payments.data ?? []) as PaymentRow[],
  }
}

/** Saves changes to a request; `event` adds an automatic note (e.g. "status:consult"). */
export async function updateRequest(id: string, patch: Partial<RequestRow>, event?: string) {
  const client = db()
  const { error } = await client.from('requests').update(patch).eq('id', id)
  if (error) throw new ApiError(error.message.includes('requests_slot_taken') ? 'slot_taken' : 'save_failed')
  if (event) await addNote(id, { event })
}

export async function addNote(requestId: string, note: { body?: string; event?: string }) {
  const { error } = await db().from('notes').insert({ request_id: requestId, ...note })
  if (error) throw new ApiError('save_failed')
}

/* ---------- Payments (35/35/30) ---------- */

/** Every payment received, for the Today list. */
export async function listPayments(): Promise<PaymentRow[]> {
  const { data, error } = await db().from('payments').select('*')
  if (error) throw new ApiError('load_failed')
  return data as PaymentRow[]
}

/** Marks one of the three payments as received, and logs it in Notes. */
export async function markPaid(requestId: string, p: { stage: 1 | 2 | 3; amount: number; method: PayMethod; paid_on: string }) {
  const { error } = await db().from('payments').insert({ request_id: requestId, ...p })
  if (error) throw new ApiError('save_failed')
  await addNote(requestId, { event: JSON.stringify({ k: 'paid', stage: p.stage, amount: p.amount, method: p.method, date: p.paid_on }) })
}

/** Undoes a payment marked by mistake, and logs it in Notes. */
export async function unmarkPaid(requestId: string, stage: 1 | 2 | 3) {
  const { error } = await db().from('payments').delete().eq('request_id', requestId).eq('stage', stage)
  if (error) throw new ApiError('save_failed')
  await addNote(requestId, { event: JSON.stringify({ k: 'unpaid', stage }) })
}
