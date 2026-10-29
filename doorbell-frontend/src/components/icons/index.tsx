import type { SvgIconProps } from '@mui/material'
import { StrokeIcon } from './StrokeIcon'

export const HomeIcon = (props: SvgIconProps) => {
  return (
    <StrokeIcon {...props}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </StrokeIcon>
  )
}

export const KeyIcon = (props: SvgIconProps) => {
  return (
    <StrokeIcon {...props}>
      <path d="M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4Z" />
      <circle cx="16.5" cy="7.5" r=".5" />
    </StrokeIcon>
  )
}

export const LogInIcon = (props: SvgIconProps) => {
  return (
    <StrokeIcon {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </StrokeIcon>
  )
}

export const PlusIcon = (props: SvgIconProps) => {
  return (
    <StrokeIcon {...props}>
      <path d="M5 12h14M12 5v14" />
    </StrokeIcon>
  )
}

export const CloseIcon = (props: SvgIconProps) => {
  return (
    <StrokeIcon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </StrokeIcon>
  )
}
