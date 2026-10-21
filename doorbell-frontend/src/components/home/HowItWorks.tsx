import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

const steps = ['preferences', 'swipe', 'match'] as const

export function HowItWorks() {
  const { t } = useTranslation()

  return (
    <Box
      component="section"
      sx={{
        mx: 'calc(50% - 50vw)',
        px: { xs: 2, md: 4 },
        py: 12,
        bgcolor: 'secondary.light',
      }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.75,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h2"
          sx={{ fontSize: { xs: 36, md: 44 }, fontWeight: 800 }}
        >
          {t('home.how.title')}
        </Typography>
        <Typography sx={{ fontSize: 21, color: 'text.secondary' }}>
          {t('home.how.subtitle')}
        </Typography>

        <Box
          sx={{
            mt: 5,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 3,
            textAlign: 'left',
          }}
        >
          {steps.map((step, index) => (
            <Box
              key={step}
              sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.75,
                bgcolor: 'background.paper',
                borderRadius: '20px',
                boxShadow: (theme) =>
                  `0 10px 30px ${theme.palette.authPanelShadow}`,
              }}
            >
              <Box
                component="img"
                src={`/home/how-${index + 1}.png`}
                alt=""
                loading="lazy"
                sx={{
                  display: 'block',
                  width: '100%',
                  height: 220,
                  objectFit: 'cover',
                  borderRadius: '12px',
                }}
              />
              <Typography
                component="span"
                sx={{
                  alignSelf: 'flex-start',
                  mt: 1,
                  px: '10px',
                  py: '5px',
                  borderRadius: '999px',
                  bgcolor: 'selectedRoleBackground',
                  color: 'primary.main',
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </Typography>
              <Typography component="h3" sx={{ fontSize: 22, fontWeight: 700 }}>
                {t(`home.how.${step}.title`)}
              </Typography>
              <Typography
                sx={{ fontSize: 17, lineHeight: 1.55, color: 'text.secondary' }}
              >
                {t(`home.how.${step}.body`)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
