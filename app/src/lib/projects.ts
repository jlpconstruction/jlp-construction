import type { Service } from './options'

// Jorge's real projects (photos in public/work, GPS and other metadata removed).
// Titles and descriptions live in the translation files under work.items.<id>.
// `before` is only set when we have a real photo of the same space before the job.
export type Project = {
  id: string
  cat: (typeof WORK_CATS)[number]
  photos: string[]
  before?: string
  services: Service[]
}

export const WORK_CATS = ['all', 'bathroom', 'basement', 'living', 'floorsDoors'] as const

export const PROJECTS: Project[] = [
  { id: 'gym', cat: 'basement', before: '/work/gym-before.jpg', photos: ['/work/gym-after.jpg'], services: ['interior', 'flooring'] },
  { id: 'suite', cat: 'basement', photos: ['/work/suite-1.jpg', '/work/suite-2.jpg', '/work/suite-3.jpg', '/work/suite-4.jpg', '/work/suite-5.jpg'], services: ['interior', 'tile', 'flooring', 'painting'] },
  { id: 'lux', cat: 'bathroom', photos: ['/work/lux-2.jpg', '/work/lux-1.jpg', '/work/lux-3.jpg'], services: ['interior', 'tile'] },
  { id: 'ledbath', cat: 'bathroom', photos: ['/work/ledbath-1.jpg', '/work/ledbath-2.jpg', '/work/ledbath-3.jpg'], services: ['interior', 'tile'] },
  { id: 'mosaic', cat: 'bathroom', photos: ['/work/mosaic-1.jpg', '/work/mosaic-2.jpg'], services: ['tile', 'flooring'] },
  { id: 'media', cat: 'living', photos: ['/work/media-2.jpg', '/work/a1.jpg'], services: ['interior', 'flooring'] },
  { id: 'stone', cat: 'bathroom', photos: ['/work/c1.jpg'], services: ['tile'] },
  { id: 'blacktile', cat: 'bathroom', photos: ['/work/c2.jpg', '/work/c3.jpg'], services: ['tile', 'flooring'] },
  { id: 'hall', cat: 'floorsDoors', photos: ['/work/hall-1.jpg', '/work/hall-2.jpg'], services: ['flooring', 'windows'] },
  { id: 'bar', cat: 'living', photos: ['/work/d1.jpg'], services: ['interior'] },
  { id: 'door', cat: 'floorsDoors', photos: ['/work/door-1.jpg'], services: ['windows'] },
  { id: 'accent', cat: 'living', photos: ['/work/b2.jpg'], services: ['painting'] },
]
