// Supabase Edge Function: the only way a request gets saved.
// 1. Checks the Cloudflare Turnstile token (the "not a robot" check) with Cloudflare.
// 2. Saves the request through submit_request(), which re-checks every field.
// 3. Returns one-time upload links for the customer's photos (the photo folder is private).
//
// Secrets (Supabase → Edge Functions → Secrets): TURNSTILE_SECRET_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PHOTO_BUCKET = 'request-photos'
const MAX_PHOTOS = 6
const KNOWN_ERRORS = ['slot_taken', 'invalid_slot', 'consent_required', 'invalid_phone', 'invalid_email', 'invalid_address']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'submit_failed' }, 405)

  let body: { token?: string; request?: Record<string, unknown>; photoCount?: number }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'submit_failed' }, 400)
  }

  // 1. The spam check
  const form = new FormData()
  form.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY') ?? '')
  form.append('response', body.token ?? '')
  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for')?.split(',')[0]
  if (ip) form.append('remoteip', ip)
  const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    .then((r) => r.json())
    .catch(() => ({ success: false }))
  if (!check.success) return reply({ error: 'spam_check' }, 400)

  // 2. Save the request (the database checks every field again)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const id = crypto.randomUUID()
  const count = Math.max(0, Math.min(MAX_PHOTOS, Math.floor(Number(body.photoCount) || 0)))
  const paths = Array.from({ length: count }, (_, i) => `${id}/${i + 1}.jpg`)
  const { data: ref, error } = await admin.rpc('submit_request', { p: { ...(body.request ?? {}), id, photos: paths } })
  if (error) {
    const known = error.message.includes('requests_email_required')
      ? 'invalid_email'
      : KNOWN_ERRORS.find((k) => error.message.includes(k))
    return reply({ error: known ?? 'submit_failed' }, 400)
  }

  // 3. One-time upload links, one per photo
  const uploads: { path: string; token: string }[] = []
  for (const path of paths) {
    const { data } = await admin.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path)
    if (data) uploads.push({ path: data.path, token: data.token })
  }

  return reply({ ref, uploads })
})
