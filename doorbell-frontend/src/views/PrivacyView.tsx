import { Link, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { InfoPage, InfoSection } from '../components/InfoPage'

export const PrivacyView = () => {
  const { t } = useTranslation()

  return (
    <InfoPage page="privacyPage" meta={t('privacyPage.updated')}>
      <InfoSection heading={t('privacyPage.questions.heading')}>
        <Typography sx={{ fontSize: 17, lineHeight: 1.7 }}>
          {t('privacyPage.questions.body')}{' '}
          <Link component={RouterLink} to="/contact">
            {t('privacyPage.questions.link')}
          </Link>
        </Typography>
      </InfoSection>
    </InfoPage>
  )
}
