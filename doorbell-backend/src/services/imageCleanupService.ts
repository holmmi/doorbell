import { cleanUpListingImages } from '../repositories/imageCleanupRepository.js'
import { deleteImageObject } from './imageService.js'

export const startImageCleanup = () => {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      await cleanUpListingImages(deleteImageObject)
    } catch (error) {
      console.error('Unable to run listing image cleanup', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      running = false
    }
  }
  void run()
  return setInterval(() => void run(), 60000).unref()
}
