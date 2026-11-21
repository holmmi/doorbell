import { Box, Link, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { InfoPage, InfoSection } from '../components/InfoPage'

const repositoryUrl = 'https://github.com/holmmi/doorbell'

const contactLinks = [
  { key: 'issues', href: `${repositoryUrl}/issues` },
  { key: 'repository', href: repositoryUrl },
] as const

export const ContactView = () => {
  const { t } = useTranslation()

  return (
    <InfoPage page="contactPage">
      <InfoSection heading={t('contactPage.links.heading')}>
        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          {contactLinks.map((link) => (
            <Typography
              component="li"
              key={link.key}
              sx={{ fontSize: 17, lineHeight: 1.7, mb: 1 }}
            >
              <Link href={link.href}>{t(`contactPage.links.${link.key}`)}</Link>{' '}
              — {t(`contactPage.links.${link.key}Description`)}
            </Typography>
          ))}
        </Box>
      </InfoSection>
    </InfoPage>
  )
}
