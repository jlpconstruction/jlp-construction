// Address suggestions from Photon, a free OpenStreetMap search service (no account or key).
// Only full street addresses in Illinois or Indiana are suggested; customers can still type by hand.
export const STATES = ['IL', 'IN'] as const
export type StateCode = (typeof STATES)[number]

export type AddressSuggestion = { street: string; city: string; state: StateCode; zip: string; label: string }

const STATE_CODE: Record<string, StateCode> = { Illinois: 'IL', Indiana: 'IN' }
// Roughly Illinois + Indiana, with results ranked by closeness to Chicago
const AREA = '&bbox=-91.6,37.0,-84.7,42.6&lat=41.88&lon=-87.63'

export async function suggestAddresses(query: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  const url = `https://photon.komoot.io/api/?limit=8&layer=house&lang=en${AREA}&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = (await res.json()) as { features: { properties: Record<string, string | undefined> }[] }
  const seen = new Set<string>()
  const out: AddressSuggestion[] = []
  for (const { properties: p } of data.features) {
    const state = STATE_CODE[p.state ?? '']
    const city = p.city ?? p.town ?? p.village ?? ''
    const zip = (p.postcode ?? '').slice(0, 5)
    if (!p.housenumber || !p.street || !state || !city || !/^\d{5}$/.test(zip)) continue
    const street = `${p.housenumber} ${p.street}`
    const label = `${street}, ${city}, ${state} ${zip}`
    if (seen.has(label)) continue
    seen.add(label)
    out.push({ street, city, state, zip, label })
  }
  return out.slice(0, 5)
}

/** "123 Main St, Chicago, IL 60601" (state and ZIP only on requests that have them). */
export const fullAddress = (r: { address: string; city: string; state?: string | null; zip?: string | null }) =>
  `${r.address}, ${r.city}${r.state ? `, ${r.state}` : ''}${r.zip ? ` ${r.zip}` : ''}`
