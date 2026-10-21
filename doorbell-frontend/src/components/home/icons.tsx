import { SvgIcon, type SvgIconProps } from '@mui/material'

// Lucide icons (https://lucide.dev), drawn with strokes instead of fills.
function LucideIcon({ children, ...props }: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </SvgIcon>
  )
}

export function BellRingIcon(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M22 8c0-2.3-.8-4.3-2-6" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
      <path d="M4 2C2.8 3.7 2 5.7 2 8" />
    </LucideIcon>
  )
}

export function CheckIcon(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </LucideIcon>
  )
}

export function XIcon(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </LucideIcon>
  )
}

export function ChevronLeftIcon(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <path d="m15 18-6-6 6-6" />
    </LucideIcon>
  )
}

export function ChevronRightIcon(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </LucideIcon>
  )
}

export function PlusIcon(props: SvgIconProps) {
  return (
    <LucideIcon {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </LucideIcon>
  )
}
