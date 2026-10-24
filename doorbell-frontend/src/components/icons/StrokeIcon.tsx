import { SvgIcon, type SvgIconProps } from '@mui/material'

// Base for outline icons (Lucide style, 24x24 viewBox, 2px stroke).
// Stroke styles go through `style` so callers can still pass `sx`.
export function StrokeIcon({ style, ...props }: SvgIconProps) {
  return (
    <SvgIcon
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
      style={{
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...style,
      }}
    />
  )
}
