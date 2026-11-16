// notify-new-request: emails Jorge (in Spanish) every time a new request is saved.
//
// How it runs: a Supabase "Database Webhook" calls this function on every INSERT into
// public.requests. The function builds a short Spanish email and sends it through Resend.
// The customer's form never waits on this, so if email ever fails, the request is still saved.
//
// Secrets (Supabase → Edge Functions → Secrets), never in the website code:
//   RESEND_API_KEY   the Resend API key
//   NOTIFY_EMAIL     who gets the notice (Jorge). Several addresses: separate with commas.
//   WEBHOOK_SECRET   a long random password; the webhook sends it in the x-webhook-secret header
//   EMAIL_FROM       optional, default "JLP Avisos <avisos@jlpconstructionchicago.com>"
//   SITE_URL         optional, default "https://jlpconstructionchicago.com"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically
// (used only to count the request's photos).
//
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor, name it
// notify-new-request, paste this whole file, Deploy, then turn OFF "Verify JWT".
// The WEBHOOK_SECRET check is what protects it.

const TZ = 'America/Chicago'

// Spanish labels (same wording as app/src/i18n/es.json → options.*)
const ROOMS: Record<string, string> = {
  kitchen: 'Cocina',
  bathroom: 'Baño',
  bedroom: 'Habitación',
  living: 'Sala / Comedor',
  basement: 'Sótano',
  exterior: 'Exterior / Otro',
}
const SERVICES: Record<string, string> = {
  interior: 'Remodelación de interiores',
  painting: 'Pintura',
  tile: 'Instalación de azulejos',
  flooring: 'Instalación de pisos',
  windows: 'Ventanas y puertas',
  other: 'Otro',
}
const SIZES: Record<string, string> = {
  small: 'Pequeño (menos de 100 pies²)',
  medium: 'Mediano (100–250 pies²)',
  large: 'Grande (más de 250 pies²)',
}
// Saved as numbers (see app/src/lib/options.ts BUDGET_ORDER)
const BUDGETS = [
  '$2,000 – $5,000',
  '$5,000 – $15,000',
  '$15,000 – $30,000',
  '$30,000 – $50,000',
  '$50,000+',
  'Aún no sé',
  'Menos de $2,000',
]
const CONTACT: Record<string, string> = { text: 'Texto', email: 'Correo' }
const LANGS: Record<string, string> = { es: 'Español', en: 'Inglés' }

export type RequestRow = {
  id: string
  ref: string
  lang: string
  name: string
  phone: string
  email: string | null
  contact_pref: string
  address: string
  city: string
  state?: string | null
  zip?: string | null
  rooms: string[]
  services: string[]
  other_service?: string | null
  description: string
  size: string
  budget: number
  slot: string | null
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

// One line only, so customer text can't add lines to the subject
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** "sábado 22 de noviembre, 10:00 a. m." in Chicago time */
export function formatSlot(iso: string | null, short = false): string {
  if (!iso) return 'Sin hora elegida'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin hora elegida'
  const day = new Intl.DateTimeFormat('es-US', {
    timeZone: TZ,
    weekday: short ? 'short' : 'long',
    day: 'numeric',
    month: short ? 'short' : 'long',
  }).format(d)
  const time = new Intl.DateTimeFormat('es-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d)
  return `${day}, ${time}`
}

const address = (r: RequestRow) =>
  `${r.address}, ${r.city}${r.state ? `, ${r.state}` : ''}${r.zip ? ` ${r.zip}` : ''}`

const servicesText = (r: RequestRow) =>
  r.services
    .map((s) => (s === 'other' && r.other_service ? `Otro: ${oneLine(r.other_service)}` : SERVICES[s] ?? s))
    .join(', ')

const roomsText = (r: RequestRow) => r.rooms.map((x) => ROOMS[x] ?? x).join(', ')

export function buildEmail(r: RequestRow, siteUrl: string, photoCount: number | null) {
  const link = `${siteUrl.replace(/\/+$/, '')}/admin/requests/${encodeURIComponent(r.id)}`
  const firstService = r.services[0] === 'other' ? 'Otro' : SERVICES[r.services[0]] ?? 'Proyecto'
  const subject = oneLine(
    `Nueva solicitud ${r.ref}: ${firstService}${r.services.length > 1 ? ' y más' : ''} · ${r.city} · ${formatSlot(r.slot, true)}`,
  )
  const phoneDigits = r.phone.replace(/[^\d+]/g, '')
  const photos = photoCount === null ? null : photoCount === 0 ? 'Sin fotos' : photoCount === 1 ? '1 foto' : `${photoCount} fotos`

  // [label, plain text, optional HTML (already escaped)]
  const rows: [string, string, string?][] = [
    ['Cliente', r.name],
    ['Teléfono', r.phone, `<a href="tel:${esc(phoneDigits)}">${esc(r.phone)}</a>`],
    ['Correo', r.email ?? '—', r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : undefined],
    ['Prefiere', CONTACT[r.contact_pref] ?? r.contact_pref],
    ['Idioma del cliente', LANGS[r.lang] ?? r.lang],
    ['Dirección', address(r)],
    ['Visita pedida', formatSlot(r.slot)],
    ['Cuartos', roomsText(r)],
    ['Servicios', servicesText(r)],
    ['Tamaño', SIZES[r.size] ?? r.size],
    ['Presupuesto', BUDGETS[r.budget] ?? '—'],
  ]
  if (photos) rows.push(['Fotos', photos])

  const td = 'padding:6px 12px 6px 0;vertical-align:top;font-size:16px;'
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;">
    <div style="background:#000;color:#fff;padding:18px 20px;">
      <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#93b4ff;">JLP Construction</div>
      <div style="font-size:22px;font-weight:bold;margin-top:4px;">Nueva solicitud ${esc(r.ref)}</div>
    </div>
    <div style="padding:20px;">
      <p style="font-size:16px;margin:0 0 16px;">
        <strong>${esc(r.name)}</strong> pidió una visita para el <strong>${esc(formatSlot(r.slot))}</strong>
        (todavía sin confirmar). Confírmela en el panel.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${esc(link)}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:12px 20px;border-radius:8px;">Abrir la solicitud</a>
      </p>
      <table role="presentation" style="border-collapse:collapse;width:100%;">
        ${rows.map(([k, plain, h]) => `<tr><td style="${td}color:#555;white-space:nowrap;">${k}</td><td style="${td}">${h ?? esc(plain)}</td></tr>`).join('\n        ')}
      </table>
      <h2 style="font-size:17px;margin:20px 0 6px;">Descripción del cliente</h2>
      <p style="font-size:16px;margin:0;white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:6px;">${esc(r.description)}</p>
      <p style="font-size:13px;color:#666;margin:24px 0 0;">
        Aviso automático del sitio jlpconstructionchicago.com. Las fotos y todos los detalles están en el panel.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = [
    `Nueva solicitud ${r.ref}`,
    `${r.name} pidió una visita para el ${formatSlot(r.slot)} (todavía sin confirmar).`,
    '',
    ...rows.map(([k, plain]) => `${k}: ${plain}`),
    '',
    'Descripción del cliente:',
    r.description,
    '',
    `Abrir la solicitud: ${link}`,
  ].join('\n')

  return { subject, html, text }
}

/** Compare secrets without leaking how many characters matched */
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

async function countPhotos(requestId: string): Promise<number | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  try {
    const res = await fetch(
      `${url}/rest/v1/request_photos?select=id&request_id=eq.${encodeURIComponent(requestId)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) return null
    const list = await res.json()
    return Array.isArray(list) ? list.length : null
  } catch {
    return null
  }
}

const reply = (status: number, body: string) => new Response(body, { status })

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return reply(405, 'method not allowed')

  const secret = Deno.env.get('WEBHOOK_SECRET') ?? ''
  if (!secret || !sameSecret(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return reply(401, 'unauthorized')
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const to = (Deno.env.get('NOTIFY_EMAIL') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!apiKey || to.length === 0) {
    console.error('Missing RESEND_API_KEY or NOTIFY_EMAIL secret')
    return reply(500, 'not configured')
  }

  let payload: { type?: string; table?: string; record?: RequestRow }
  try {
    payload = await req.json()
  } catch {
    return reply(400, 'bad json')
  }
  // Only new requests; ignore anything else the webhook might send
  if (payload.type !== 'INSERT' || payload.table !== 'requests' || !payload.record?.id) {
    return reply(200, 'ignored')
  }

  const r = payload.record
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://jlpconstructionchicago.com'
  const from = Deno.env.get('EMAIL_FROM') ?? 'JLP Avisos <avisos@jlpconstructionchicago.com>'
  const { subject, html, text } = buildEmail(r, siteUrl, await countPhotos(r.id))

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // If the webhook retries, Resend won't send the same notice twice
      'Idempotency-Key': `new-request-${r.id}`,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text())
    return reply(502, 'email failed')
  }
  console.log(`Sent notice for ${r.ref}`)
  return reply(200, 'sent')
}

// In Supabase this starts the function. (Skipped when the file is loaded by the local test.)
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
