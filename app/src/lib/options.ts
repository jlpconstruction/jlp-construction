// Choices are stored as keys/indexes; labels live in the translation files (options.*).
export const ROOMS = ['kitchen', 'bathroom', 'bedroom', 'living', 'basement', 'exterior'] as const
export const SERVICES = ['interior', 'painting', 'tile', 'flooring', 'windows'] as const
export const SIZES = ['small', 'medium', 'large'] as const
// Budget choices are saved as these numbers (options.budgets.<n>). New choices get a new number,
// so saved requests keep their meaning; BUDGET_ORDER is the order they're shown in.
export const BUDGET_ORDER = [6, 0, 1, 2, 3, 4, 5] // 6 = under $2,000 … 5 = not sure yet
export const CONTACT_PREFS = ['text', 'email'] as const
export const STATUSES = ['new', 'needs-info', 'consult', 'quoted', 'won', 'declined'] as const

export type Room = (typeof ROOMS)[number]
export type Service = (typeof SERVICES)[number] | 'other'
export type Size = (typeof SIZES)[number]
export type ContactPref = (typeof CONTACT_PREFS)[number]
export type Status = (typeof STATUSES)[number]

export const SERVICE_ICON: Record<(typeof SERVICES)[number], string> = {
  interior: 'home',
  painting: 'paint',
  tile: 'tile',
  flooring: 'floor',
  windows: 'door',
}
export const ROOM_ICON: Record<Room, string> = {
  kitchen: 'kitchen',
  bathroom: 'bath',
  bedroom: 'bed',
  living: 'sofa',
  basement: 'stairs',
  exterior: 'house',
}

// Jorge's public business number (from his Facebook page)
export const PHONE = { display: '(773) 490-8021', tel: 'tel:+17734908021' }

export const isOpen = (s: Status) => s !== 'won' && s !== 'declined'
