import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon } from './icons'

const questions = [
  'free',
  'replySpeed',
  'afterMatch',
  'verified',
  'landlordCost',
] as const

type Question = (typeof questions)[number]

function ToggleIcon({ open }: { open: boolean }) {
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: open ? 'primary.main' : 'selectedRoleBackground',
        color: open ? 'common.white' : 'primary.main',
        transition: 'background-color 200ms ease, color 200ms ease',
      }}
    >
      <PlusIcon sx={{ fontSize: 20 }} />
    </Box>
  )
}

export function Faq() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Question | false>(questions[0])

  return (
    <Box
      component="section"
      sx={{
        pb: 15,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <Typography
        variant="h2"
        sx={{
          fontSize: { xs: 36, md: 48 },
          lineHeight: 1.1,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          textAlign: 'center',
        }}
      >
        {t('home.faq.title')}
      </Typography>

      <Box
        sx={{
          width: '100%',
          maxWidth: 860,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {questions.map((question) => (
          <Accordion
            key={question}
            expanded={expanded === question}
            onChange={(_, isExpanded) =>
              setExpanded(isExpanded ? question : false)
            }
            elevation={0}
            disableGutters
            sx={{
              border: '1px solid',
              borderColor: 'grey.100',
              '&, &:first-of-type, &:last-of-type': { borderRadius: '18px' },
              '&::before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ToggleIcon open={expanded === question} />}
              sx={{
                px: '26px',
                py: '10px',
                '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
                  transform: 'rotate(45deg)',
                },
              }}
            >
              <Typography component="h3" sx={{ fontSize: 20, fontWeight: 700 }}>
                {t(`home.faq.${question}.question`)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: '26px', pt: 0, pb: 3 }}>
              <Typography
                sx={{ fontSize: 17, lineHeight: 1.6, color: 'text.secondary' }}
              >
                {t(`home.faq.${question}.answer`)}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  )
}
