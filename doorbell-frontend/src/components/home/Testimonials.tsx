import { Avatar, Box, Rating, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

const reviews = [
  { key: 'emilia', rating: 5 },
  { key: 'mikko', rating: 4 },
  { key: 'saara', rating: 5 },
] as const

export function Testimonials() {
  const { t } = useTranslation()

  return (
    <Box
      component="section"
      sx={{
        pt: 14,
        pb: 15,
        maxWidth: 1280,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Typography
        variant="h2"
        sx={{
          fontSize: { xs: 36, md: 44 },
          fontWeight: 800,
          textAlign: 'center',
        }}
      >
        {t('home.reviews.title')}
      </Typography>

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 3,
        }}
      >
        {reviews.map(({ key, rating }) => {
          const name = t(`home.reviews.${key}.name`)
          return (
            <Box
              key={key}
              component="figure"
              sx={{
                m: 0,
                p: 3.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.25,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'grey.100',
                borderRadius: '20px',
                boxShadow: (theme) =>
                  `0 10px 30px ${theme.palette.authPanelShadow}`,
              }}
            >
              <Rating
                value={rating}
                readOnly
                sx={{ '& .MuiRating-iconFilled': { color: 'primary.main' } }}
              />
              <Typography
                component="blockquote"
                sx={{ m: 0, fontSize: 17, lineHeight: 1.6 }}
              >
                {t(`home.reviews.${key}.quote`)}
              </Typography>
              <Box
                component="figcaption"
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
              >
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: 'secondary.light',
                    color: 'text.primary',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                    {name}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                    {t(`home.reviews.${key}.city`)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
