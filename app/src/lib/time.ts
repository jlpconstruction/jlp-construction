// Consultations: Saturdays, 9 am – 6 pm (last start 5 pm), 1-hour visits, Chicago time.
export const TZ = 'America/Chicago'
export const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17]
export const SLOT_MINUTES = 60
export const WEEKS_AHEAD = 4

export type Ymd = { y: number; m: number; d: number }

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function chicagoParts(date: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second }
}

/** The real instant for a wall-clock hour in Chicago (handles daylight saving). */
export function chicagoTime({ y, m, d }: Ymd, hour: number): Date {
  const guess = Date.UTC(y, m - 1, d, hour)
  const p = chicagoParts(new Date(guess))
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - guess
  return new Date(guess - offset)
}

/** The next `count` Saturdays in Chicago, starting tomorrow. */
export function upcomingSaturdays(count = WEEKS_AHEAD, from = new Date()): Ymd[] {
  const today = chicagoParts(from)
  const start = new Date(Date.UTC(today.y, today.m - 1, today.d + 1))
  while (start.getUTCDay() !== 6) start.setUTCDate(start.getUTCDate() + 1)
  return Array.from({ length: count }, (_, i) => {
    const x = new Date(start)
    x.setUTCDate(start.getUTCDate() + 7 * i)
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }
  })
}

export const slotsFor = (day: Ymd) => SLOT_HOURS.map((h) => chicagoTime(day, h))

/** Is this instant on the given Chicago calendar day? */
export function sameDay(a: Date | string, day: Ymd) {
  const p = chicagoParts(new Date(a))
  return p.y === day.y && p.m === day.m && p.d === day.d
}

export const chicagoHour = (date = new Date()) => chicagoParts(date).h

const locale = (lng: string) => (lng.startsWith('es') ? 'es-US' : 'en-US')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const fmtTime = (d: Date | string, lng: string) =>
  new Date(d).toLocaleTimeString(locale(lng), { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
export const fmtDate = (d: Date | string, lng: string) =>
  new Date(d).toLocaleDateString(locale(lng), { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
export const fmtDateTime = (d: Date | string, lng: string) => `${fmtDate(d, lng)}, ${fmtTime(d, lng)}`
export const fmtLongDay = (d: Date | string, lng: string) =>
  cap(new Date(d).toLocaleDateString(locale(lng), { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' }))
export const ymdDate = (day: Ymd) => chicagoTime(day, 12)

export function timeAgo(d: Date | string, lng: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  const rtf = new Intl.RelativeTimeFormat(locale(lng), { numeric: 'auto', style: 'short' })
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.round(hours / 24), 'day')
}

export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

/* Calendar links: Google Calendar "add event" link + .ics file (no Calendar API needed) */
const gfmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export type CalEvent = { start: Date; title: string; details: string; location: string; uid: string }

export function googleCalendarUrl(e: CalEvent) {
  const end = new Date(e.start.getTime() + SLOT_MINUTES * 60000)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${gfmt(e.start)}/${gfmt(end)}`,
    details: e.details,
    location: e.location,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

export function icsUrl(e: CalEvent) {
  const end = new Date(e.start.getTime() + SLOT_MINUTES * 60000)
  const esc = (x: string) => x.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JLP Construction//Dashboard//EN',
    'BEGIN:VEVENT',
    `UID:${e.uid}@jlpconstruction`,
    `DTSTAMP:${gfmt(new Date())}`,
    `DTSTART:${gfmt(e.start)}`,
    `DTEND:${gfmt(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)
}
