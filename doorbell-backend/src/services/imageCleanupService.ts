import { cleanUpImages } from '../repositories/imageCleanupRepository.js'
import { deleteImageObject } from './imageService.js'

export const startImageCleanup = () => {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      await cleanUpImages(deleteImageObject)
    } catch (error) {
      console.error('Unable to run image cleanup', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      running = false
    }
  }
  void run()
  return setInterval(() => void run(), 60000).unref()
}
