import { Box } from '@mui/material'
import { Link as RouterLink } from 'react-router'

type ProfileAvatarProps = {
  src?: string | null
  alt?: string
}

export function ProfileAvatar({
  src,
  alt = 'Profile picture',
}: ProfileAvatarProps) {
  return (
    <RouterLink
      to="/profile"
      style={{
        display: 'inline-flex',
        textDecoration: 'none',
      }}
      aria-label={alt}
    >
      <Box
        component="div"
        role="img"
        aria-label={alt}
        sx={{
          width: 42,
          height: 42,
          borderRadius: 10,
          border: '2px solid',
          borderColor: 'grey.300',
          backgroundColor: src ? 'transparent' : 'grey.100',
          color: 'grey.500',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          backgroundImage: src ? `url(${src})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!src ? (
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.9" />
            <path
              d="M4 18.5C5.6 15.6 8.3 14 12 14C15.7 14 18.4 15.6 20 18.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
      </Box>
    </RouterLink>
  )
}
