import { use } from 'react'
import { LikesContext } from '../state/LikesProvider'

export const useLikes = () => {
  const likes = use(LikesContext)
  if (!likes) throw new Error('useLikes must be used inside LikesProvider')
  return likes
}
