import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { decideApplicant, getPendingApplicants } from '../api/listingClient'
import { getLandlordMatches } from '../api/listingClient'
import type {
  ApplicantDecision,
  PendingApplicant,
  LandlordMatch,
} from '../types/listingInteraction'
import { brand } from '../theme/tokens'
import { formatNumber } from '../utils/format'

const errorCodeOf = (error: unknown) =>
  error instanceof ApiError ? error.code : 'error.unknown'

export const LikesView = () => {
  const { t, i18n } = useTranslation()
  const [applicants, setApplicants] = useState<PendingApplicant[] | null>(null)
  const [matches, setMatches] = useState<LandlordMatch[] | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null)
  const [matchesErrorCode, setMatchesErrorCode] = useState<string | null>(null)
  const [actionErrorCode, setActionErrorCode] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setApplicants(null)
    setMatches(null)
    setLoadErrorCode(null)
    setMatchesErrorCode(null)
    try {
      const [pending, landlordMatches] = await Promise.all([
        getPendingApplicants(),
        getLandlordMatches(),
      ])
      setApplicants(pending)
      setMatches(landlordMatches)
    } catch (error: unknown) {
      setApplicants(null)
      setMatches(null)
      setLoadErrorCode(errorCodeOf(error))
    }
  }, [])

  const refreshMatches = useCallback(async () => {
    setMatchesErrorCode(null)
    try {
      setMatches(await getLandlordMatches())
    } catch (error: unknown) {
      setMatchesErrorCode(errorCodeOf(error))
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => loadData())
  }, [loadData])

  const handleDecision = async (
    applicant: PendingApplicant,
    decision: ApplicantDecision
  ) => {
    const key = `${applicant.listing.id}:${applicant.tenantId}`
    setBusyKey(key)
    setActionErrorCode(null)
    try {
      await decideApplicant(applicant.listing.id, applicant.tenantId, decision)
      setApplicants(
        (current) => current?.filter((item) => item !== applicant) ?? current
      )
      if (decision === 'ACCEPTED') {
        await refreshMatches()
      }
      setNotice(
        decision === 'ACCEPTED'
          ? t('likes.accepted', {
              name: `${applicant.firstName} ${applicant.lastName}`,
            })
          : t('likes.declined', {
              name: `${applicant.firstName} ${applicant.lastName}`,
            })
      )
    } catch (error: unknown) {
      setActionErrorCode(errorCodeOf(error))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 0, sm: 3 }, py: 6 }}>
      <Typography variant="h1" sx={{ fontSize: { xs: 42, md: 60 }, mb: 1 }}>
        {t('likes.title')}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 18, mb: 5 }}>
        {t('likes.subtitle')}
      </Typography>

      {loadErrorCode !== null ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void loadData()}
            >
              {t('likes.retry')}
            </Button>
          }
        >
          {t(loadErrorCode, { defaultValue: t('likes.loadError') })}
        </Alert>
      ) : applicants === null || matches === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Section title={t('likes.waiting')} count={applicants.length}>
            {applicants.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                  gap: 3,
                }}
              >
                {applicants.map((applicant) => {
                  const key = `${applicant.listing.id}:${applicant.tenantId}`
                  const image = applicant.listing.images[0]?.imageUrl
                  return (
                    <Box
                      component="article"
                      key={key}
                      sx={{
                        bgcolor: 'background.paper',
                        border: `1.5px solid ${brand.purple}`,
                        borderRadius: '22px',
                        boxShadow: '0 12px 32px rgba(110, 68, 255, 0.1)',
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                      >
                        <Avatar
                          alt=""
                          sx={{
                            width: 58,
                            height: 58,
                            bgcolor: brand.purple50,
                            color: brand.purple,
                          }}
                        >
                          {applicant.firstName.charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
                            {applicant.firstName} {applicant.lastName}
                          </Typography>
                          <Typography color="text.secondary">
                            {t('likes.interestedIn')}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.25,
                          borderRadius: '14px',
                          bgcolor: 'background.default',
                        }}
                      >
                        <Box
                          component="img"
                          src={image}
                          alt=""
                          sx={{
                            width: 84,
                            height: 64,
                            objectFit: 'cover',
                            borderRadius: '12px',
                            bgcolor: 'photoPlaceholder',
                          }}
                        />
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {applicant.listing.neighborhood},{' '}
                            {applicant.listing.city}
                          </Typography>
                          <Typography color="text.secondary">
                            €
                            {formatNumber(
                              Number(applicant.listing.monthlyPrice),
                              i18n.language
                            )}
                            {t('likes.perMonth')} ·{' '}
                            {formatNumber(
                              Number(applicant.listing.squareMeters),
                              i18n.language
                            )}{' '}
                            m²
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 1.25,
                        }}
                      >
                        <Button
                          variant="contained"
                          color="secondary"
                          disabled={busyKey !== null}
                          onClick={() => {
                            void handleDecision(applicant, 'DECLINED')
                          }}
                        >
                          {t('likes.decline')}
                        </Button>
                        <Button
                          variant="contained"
                          disabled={busyKey !== null}
                          onClick={() => {
                            void handleDecision(applicant, 'ACCEPTED')
                          }}
                        >
                          {t('likes.accept')}
                        </Button>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            ) : (
              <EmptySection>{t('likes.empty')}</EmptySection>
            )}
          </Section>
          <Section title={t('likes.matched')} count={matches.length}>
            {matchesErrorCode ? (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void refreshMatches()}
                  >
                    {t('likes.retry')}
                  </Button>
                }
              >
                {t(matchesErrorCode, {
                  defaultValue: t('likes.matchesRefreshError'),
                })}
              </Alert>
            ) : matches.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                  gap: 3,
                }}
              >
                {matches.map((match) => (
                  <Box
                    component="article"
                    key={`${match.listing.id}:${match.tenantId}`}
                    sx={{
                      bgcolor: 'background.paper',
                      border: `1px solid ${brand.border}`,
                      borderRadius: '22px',
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                    >
                      <Avatar
                        alt=""
                        sx={{
                          width: 52,
                          height: 52,
                          bgcolor: brand.purple50,
                          color: brand.purple,
                        }}
                      >
                        {match.firstName.charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 19, fontWeight: 700 }}>
                          {match.firstName} {match.lastName}
                        </Typography>
                        <Typography color="text.secondary">
                          {match.listing.neighborhood}, {match.listing.city}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          px: 1,
                          py: 0.5,
                          borderRadius: '999px',
                          bgcolor: 'secondary.light',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {t('likes.matchedBadge')}
                      </Typography>
                    </Box>
                    <Box sx={{ color: 'text.secondary', fontSize: 15 }}>
                      <Typography component="div">{match.email}</Typography>
                      {match.phone ? (
                        <Typography component="div">{match.phone}</Typography>
                      ) : null}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <EmptySection>{t('likes.matchedEmpty')}</EmptySection>
            )}
          </Section>
        </Box>
      )}

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      </Snackbar>
      <Snackbar
        open={actionErrorCode !== null}
        autoHideDuration={7000}
        onClose={() => setActionErrorCode(null)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setActionErrorCode(null)}
        >
          {actionErrorCode
            ? t(actionErrorCode, { defaultValue: t('error.unknown') })
            : null}
        </Alert>
      </Snackbar>
    </Box>
  )
}

const Section = ({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) => {
  return (
    <Box
      component="section"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      <Typography variant="h2" sx={{ fontSize: 28 }}>
        {title}{' '}
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          · {count}
        </Box>
      </Typography>
      {children}
    </Box>
  )
}

const EmptySection = ({ children }: { children: ReactNode }) => {
  return (
    <Box
      sx={{
        p: 4,
        border: `1.5px dashed ${brand.borderInput}`,
        borderRadius: '20px',
        textAlign: 'center',
        color: 'text.secondary',
        bgcolor: 'background.paper',
      }}
    >
      {children}
    </Box>
  )
}
