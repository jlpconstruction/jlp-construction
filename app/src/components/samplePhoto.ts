// Illustrated placeholder "photos" for the sample Our Work projects.
// Replace with Jorge's real photos of finished work.
export function samplePhoto(room: string, variant = 0) {
  const pal = [
    ['#c9b79c', '#8a6f4e'],
    ['#b8c4cc', '#5b6f7d'],
    ['#d8cfc4', '#7d6a58'],
    ['#a9b8a2', '#5d6e57'],
  ][variant % 4]
  const art: Record<string, string> = {
    kitchen: `<rect x="40" y="60" width="320" height="70" fill="${pal[1]}" opacity=".85"/><rect x="40" y="170" width="320" height="90" fill="${pal[1]}"/><rect x="30" y="160" width="340" height="12" fill="#eee"/>${[0, 1, 2, 3].map((i) => `<rect x="${52 + i * 78}" y="70" width="66" height="50" fill="none" stroke="#fff" stroke-opacity=".4"/>`).join('')}`,
    bathroom: `<rect x="60" y="170" width="200" height="80" rx="30" fill="#f4f4f4"/><rect x="280" y="120" width="70" height="130" fill="${pal[1]}"/><circle cx="315" cy="105" r="18" fill="#ddd"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${40 + i * 50}" y1="30" x2="${40 + i * 50}" y2="160" stroke="#fff" stroke-opacity=".35"/>`).join('')}`,
    living: `<rect x="60" y="160" width="280" height="60" rx="10" fill="${pal[1]}"/><rect x="60" y="130" width="280" height="40" rx="10" fill="${pal[1]}" opacity=".8"/><rect x="150" y="50" width="100" height="60" fill="#fff" opacity=".5"/>`,
    basement: `<rect x="40" y="40" width="320" height="200" fill="none" stroke="${pal[1]}" stroke-width="6"/>${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${70 + i * 50}" y1="40" x2="${70 + i * 50}" y2="240" stroke="${pal[1]}" stroke-width="5"/>`).join('')}`,
    exterior: `<polygon points="200,40 340,130 60,130" fill="${pal[1]}"/><rect x="85" y="130" width="230" height="120" fill="#efe9df"/><rect x="180" y="180" width="40" height="70" fill="${pal[1]}"/><rect x="110" y="160" width="45" height="40" fill="#bcd"/><rect x="245" y="160" width="45" height="40" fill="#bcd"/>`,
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${pal[0]}"/><rect y="250" width="400" height="50" fill="${pal[1]}" opacity=".5"/>${art[room] ?? ''}<text x="12" y="290" font-family="sans-serif" font-size="13" fill="#fff" opacity=".85">Sample photo / Foto de ejemplo</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export const WORK = [
  { id: 'w1', cat: 'bathroom', room: 'bathroom', v: [0, 1], city: 'Cicero, IL', weeks: 3, services: ['interior', 'tile'] },
  { id: 'w2', cat: 'kitchen', room: 'kitchen', v: [3, 2], city: 'Oak Park, IL', weeks: 1, services: ['tile', 'painting'] },
  { id: 'w3', cat: 'basement', room: 'basement', v: [1, 3], city: 'Forest Park, IL', weeks: 6, services: ['interior', 'flooring', 'painting'] },
  { id: 'w4', cat: 'flooring', room: 'living', v: [2, 0], city: 'Hammond, IN', weeks: 2, services: ['flooring'] },
  { id: 'w5', cat: 'windows', room: 'exterior', v: [1, 2], city: 'Chicago, IL', weeks: 1, services: ['windows'] },
  { id: 'w6', cat: 'painting', room: 'living', v: [3, 1], city: 'Berwyn, IL', weeks: 1, services: ['painting'] },
] as const
export const WORK_CATS = ['all', 'kitchen', 'bathroom', 'basement', 'flooring', 'painting', 'windows'] as const
