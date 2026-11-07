import { supabase } from './supabase'
import type { ContactPref, Room, Service, Size, Status } from './options'

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
  slot: string
  sms_consent: boolean
  sms_consent_text: string
  no_feature: boolean
}

/** Uploads the photos, then saves the request. Returns the reference number. */
export async function submitRequest(req: NewRequest, photos: Blob[]): Promise<string> {
  const client = db()
  const id = crypto.randomUUID()
  const paths: string[] = []
  for (const [i, blob] of photos.entries()) {
    const path = `${id}/${i + 1}.jpg`
    const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new ApiError('photo_upload')
    paths.push(path)
  }
  const { data, error } = await client.rpc('submit_request', { p: { ...req, id, photos: paths } })
  if (error) {
    const known = ['slot_taken', 'invalid_slot', 'consent_required', 'invalid_phone', 'invalid_email']
    throw new ApiError(known.find((k) => error.message.includes(k)) ?? 'submit_failed')
  }
  return data as string
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
}

export type NoteRow = { id: string; created_at: string; body: string | null; event: string | null }

export async function listRequests(): Promise<RequestRow[]> {
  const { data, error } = await db().from('requests').select('*').order('created_at', { ascending: false })
  if (error) throw new ApiError('load_failed')
  return data as RequestRow[]
}

export async function getRequest(id: string) {
  const client = db()
  const [req, photos, notes] = await Promise.all([
    client.from('requests').select('*').eq('id', id).maybeSingle(),
    client.from('request_photos').select('storage_path').eq('request_id', id).order('storage_path'),
    client.from('notes').select('id, created_at, body, event').eq('request_id', id).order('created_at'),
  ])
  if (req.error || photos.error || notes.error) throw new ApiError('load_failed')
  let photoUrls: string[] = []
  const paths = (photos.data ?? []).map((p) => p.storage_path as string)
  if (paths.length) {
    // Private bucket: signed links that expire after 10 minutes
    const { data } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 600)
    photoUrls = (data ?? []).flatMap((x) => (x.signedUrl ? [x.signedUrl] : []))
  }
  return { request: req.data as RequestRow | null, photoUrls, notes: (notes.data ?? []) as NoteRow[] }
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
