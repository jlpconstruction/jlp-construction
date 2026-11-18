// notify-new-request: sends two emails every time a new request is saved:
//   1. a notice to Jorge, in Spanish, with all the details and a link to the dashboard
//   2. a "we got your request" email to the customer, in the language they used on the form
//
// How it runs: a Supabase "Database Webhook" calls this function on every INSERT into
// public.requests. The function builds the emails and sends them through Resend.
// The customer's form never waits on this, so if email ever fails, the request is still saved.
// The two emails are sent separately, so one failing doesn't stop the other.
//
// Customer-facing wording reuses the site's confirmation screen (app/src/i18n → form.done)
// and must stay in both English and Spanish.
//
// Secrets (Supabase → Edge Functions → Secrets), never in the website code:
//   RESEND_API_KEY   the Resend API key
//   NOTIFY_EMAIL     who gets the notice (Jorge). Several addresses: separate with commas.
//   WEBHOOK_SECRET   a long random password; the webhook sends it in the x-webhook-secret header
//   REPLY_TO         where customer replies go (Jorge's email). Default: the first NOTIFY_EMAIL address.
//   EMAIL_FROM       optional, default "JLP Avisos <avisos@jlpconstructionchicago.com>" (Jorge's notice)
//   CUSTOMER_FROM    optional, default "JLP Construction <avisos@jlpconstructionchicago.com>"
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

// English labels (same wording as app/src/i18n/en.json → options.*), for the customer email
const ROOMS_EN: Record<string, string> = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  bedroom: 'Bedroom',
  living: 'Living / Dining',
  basement: 'Basement',
  exterior: 'Exterior / Other',
}
const SERVICES_EN: Record<string, string> = {
  interior: 'Interior Renovations',
  painting: 'Painting',
  tile: 'Tile Installation',
  flooring: 'Flooring Installation',
  windows: 'Windows & Doors',
  other: 'Other',
}

// Customer email wording. Lines marked "site" match the confirmation screen on the website.
const CUSTOMER = {
  en: {
    subject: (ref: string) => `We got your request (${ref}) – JLP Construction`,
    title: 'Request received!', // site
    thanks: (first: string, ref: string) => `Thanks, ${first}. Your reference number is ${ref}.`, // site
    next: (via: string) => `Jorge will review your project details and reach out by ${via} within 1–3 business days.`, // site
    via: { text: 'text', email: 'email' } as Record<string, string>, // site
    slot: 'Requested consultation', // site
    pending: 'pending confirmation', // site
    rooms: 'Room(s)',
    services: 'Services',
    address: 'Address',
    reply: 'Need to change something or add photos? Just reply to this email.',
    footer: 'JLP Construction LLC · Residential remodeling, locally owned in Chicago, serving Illinois and Indiana.',
    why: 'You got this email because you asked for a free visit at jlpconstructionchicago.com.',
    rooms_: ROOMS_EN,
    services_: SERVICES_EN,
  },
  es: {
    subject: (ref: string) => `Recibimos su solicitud (${ref}) – JLP Construction`,
    title: '¡Recibimos su solicitud!', // site
    thanks: (first: string, ref: string) => `Gracias, ${first}. Su número de referencia es ${ref}.`, // site
    next: (via: string) => `Jorge revisará los detalles de su proyecto y se comunicará con usted por ${via} en 1 a 3 días hábiles.`, // site
    via: { text: 'mensaje de texto', email: 'correo' } as Record<string, string>, // site
    slot: 'Consulta solicitada', // site
    pending: 'pendiente de confirmar', // site
    rooms: 'Espacio(s)',
    services: 'Servicios',
    address: 'Dirección',
    reply: '¿Necesita cambiar algo o agregar fotos? Solo responda a este correo.',
    footer: 'JLP Construction LLC · Remodelación residencial, negocio local en Chicago; servimos Illinois e Indiana.',
    why: 'Recibe este correo porque pidió una visita gratis en jlpconstructionchicago.com.',
    rooms_: ROOMS,
    services_: SERVICES,
  },
}

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

/** "sábado, 22 de noviembre, 10:00 a.m." / "Saturday, November 22, 10:00 AM" in Chicago time */
export function formatSlot(iso: string | null, short = false, lang: 'es' | 'en' = 'es'): string {
  const none = lang === 'en' ? 'No time chosen' : 'Sin hora elegida'
  if (!iso) return none
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return none
  const locale = lang === 'en' ? 'en-US' : 'es-US'
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    weekday: short ? 'short' : 'long',
    day: 'numeric',
    month: short ? 'short' : 'long',
  }).format(d)
  const time = new Intl.DateTimeFormat(locale, { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d)
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
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

/** The "we got your request" email to the customer, in the language they used on the form. */
export function buildCustomerEmail(r: RequestRow) {
  const lang = r.lang === 'es' ? 'es' : 'en'
  const c = CUSTOMER[lang]
  const first = oneLine(r.name).split(' ')[0] || r.name
  const services = r.services
    .map((s) => (s === 'other' && r.other_service ? `${c.services_.other}: ${oneLine(r.other_service)}` : c.services_[s] ?? s))
    .join(', ')
  const rows: [string, string][] = [
    [c.slot, `${formatSlot(r.slot, false, lang)} (${c.pending})`],
    [c.rooms, r.rooms.map((x) => c.rooms_[x] ?? x).join(', ')],
    [c.services, services],
    [c.address, address(r)],
  ]
  const thanks = c.thanks(first, r.ref)
  const next = c.next(c.via[r.contact_pref] ?? c.via.email)

  const td = 'padding:6px 12px 6px 0;vertical-align:top;font-size:16px;'
  const html = `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;">
    <div style="background:#000;color:#fff;padding:18px 20px;">
      <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#93b4ff;">JLP Construction</div>
      <div style="font-size:24px;font-weight:bold;margin-top:4px;">${esc(c.title)}</div>
    </div>
    <div style="padding:20px;">
      <p style="font-size:17px;margin:0 0 12px;">${esc(thanks)}</p>
      <p style="font-size:17px;margin:0 0 18px;">${esc(next)}</p>
      <table role="presentation" style="border-collapse:collapse;width:100%;border-top:1px solid #e4e4e7;">
        ${rows.map(([k, v]) => `<tr><td style="${td}color:#555;">${esc(k)}</td><td style="${td}">${esc(v)}</td></tr>`).join('\n        ')}
      </table>
      <p style="font-size:17px;margin:18px 0 0;">${esc(c.reply)}</p>
      <p style="font-size:13px;color:#666;margin:24px 0 0;">${esc(c.footer)}<br>${esc(c.why)}</p>
    </div>
  </div>
</body>
</html>`

  const text = [c.title, '', thanks, next, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', c.reply, '', c.footer, c.why].join('\n')
  return { subject: oneLine(c.subject(r.ref)), html, text }
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
  const customerFrom = Deno.env.get('CUSTOMER_FROM') ?? 'JLP Construction <avisos@jlpconstructionchicago.com>'
  const replyTo = (Deno.env.get('REPLY_TO') ?? '').trim() || to[0]

  const send = async (key: string, email: Record<string, unknown>) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // If the webhook retries, Resend won't send the same email twice
        'Idempotency-Key': key,
      },
      body: JSON.stringify(email),
    })
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`)
  }

  const jorge = send(`new-request-${r.id}`, { from, to, ...buildEmail(r, siteUrl, await countPhotos(r.id)) })
  const customer = r.email
    ? send(`customer-confirm-${r.id}`, { from: customerFrom, to: [r.email], reply_to: replyTo, ...buildCustomerEmail(r) })
    : Promise.resolve()
  const [j, c] = await Promise.allSettled([jorge, customer])

  if (c.status === 'rejected') console.error(`Customer email for ${r.ref} failed:`, c.reason)
  else if (r.email) console.log(`Sent customer email for ${r.ref}`)
  if (j.status === 'rejected') {
    console.error(`Notice to Jorge for ${r.ref} failed:`, j.reason)
    return reply(502, 'email failed')
  }
  console.log(`Sent notice for ${r.ref}`)
  return reply(200, c.status === 'rejected' ? 'sent (customer email failed)' : 'sent')
}

// In Supabase this starts the function. (Skipped when the file is loaded by the local test.)
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
