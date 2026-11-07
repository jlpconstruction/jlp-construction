export const MAX_PHOTOS = 6
const MAX_SIDE = 1600

export type PreparedPhoto = { blob: Blob; url: string }

/**
 * Shrinks a phone photo in the browser and re-encodes it as JPEG. Redrawing on a canvas
 * drops all EXIF metadata, including the GPS location.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.8),
  )
  return { blob, url: URL.createObjectURL(blob) }
}
