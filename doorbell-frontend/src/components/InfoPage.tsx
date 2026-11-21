import { Box, Typography } from '@mui/material'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type InfoSectionContent = {
  heading: string
  paragraphs?: string[]
  items?: string[]
}

type InfoPageProps = {
  // i18n namespace with `title`, `intro` and a `sections` array.
  page: 'privacyPage' | 'aboutPage' | 'contactPage'
  meta?: string
  children?: ReactNode
}

const bodyText = { fontSize: 17, lineHeight: 1.7 } as const

export const InfoSection = ({
  heading,
  paragraphs = [],
  items = [],
  children,
}: InfoSectionContent & { children?: ReactNode }) => (
  <Box component="section">
    <Typography
      variant="h2"
      sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 700, mb: 1.5 }}
    >
      {heading}
    </Typography>
    {paragraphs.map((paragraph) => (
      <Typography key={paragraph} sx={{ ...bodyText, mb: 1.5 }}>
        {paragraph}
      </Typography>
    ))}
    {items.length > 0 ? (
      <Box component="ul" sx={{ m: 0, pl: 3 }}>
        {items.map((item) => (
          <Typography component="li" key={item} sx={{ ...bodyText, mb: 1 }}>
            {item}
          </Typography>
        ))}
      </Box>
    ) : null}
    {children}
  </Box>
)

// Shared layout for the public text pages linked from the footer.
export const InfoPage = ({ page, meta, children }: InfoPageProps) => {
  const { t } = useTranslation()
  const sections = t(`${page}.sections`, {
    returnObjects: true,
  }) as unknown as InfoSectionContent[]

  // These pages open from the footer; start each one at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  return (
    <Box
      component="article"
      sx={{
        maxWidth: 760,
        mx: 'auto',
        py: { xs: 3, md: 6 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 3.5, md: 4.5 },
      }}
    >
      <Box component="header">
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 36, md: 52 }, fontWeight: 800, mb: 1.5 }}
        >
          {t(`${page}.title`)}
        </Typography>
        {meta ? (
          <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
            {meta}
          </Typography>
        ) : null}
        <Typography sx={{ fontSize: { xs: 18, md: 20 }, lineHeight: 1.6 }}>
          {t(`${page}.intro`)}
        </Typography>
      </Box>
      {sections.map((section) => (
        <InfoSection key={section.heading} {...section} />
      ))}
      {children}
    </Box>
  )
}
