import { Alert, Link, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import { apiGet } from '../../api/client'
import type { MacroObservation } from '../../api/marketData'
import { useI18n } from '../../i18n'
import { WorkstationCard } from './WorkspacePrimitives'

export default function OfficialReferenceCard({ timezone }: { timezone: string }) {
  const { t, locale } = useI18n()
  const query = useQuery<MacroObservation[]>({ queryKey: ['officialDailyReferences'],
    queryFn: ({ signal }) => apiGet('/market-workspace/official-context', signal), staleTime: 60 * 60_000,
    retry: false, refetchInterval: 60 * 60_000, refetchIntervalInBackground: false })
  return <WorkstationCard title={t('officialContext.title')} icon={PublicOutlinedIcon}>
    <Typography variant="caption">{t('officialContext.boundary')}</Typography>
    {query.isLoading && <Typography role="status">{t('common.loading')}</Typography>}
    {query.isError && <Alert severity="warning">{t('officialContext.failed')}</Alert>}
    {['USD', 'GBP'].map(currency => {
      const item = (Array.isArray(query.data) ? query.data : []).find(row => row.provider === 'ECB' && row.provenance === 'OFFICIAL_PUBLIC'
        && row.canonicalInstrument === `ECB_EUR_${currency}` && row.providerSymbol === currency
        && row.priceBasis === 'OFFICIAL_DAILY_REFERENCE' && row.unit === `${currency} per EUR`)
      return <Stack key={currency} spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="body2">1 EUR = {item?.value != null && Number.isFinite(item.value) ? `${item.value} ${currency}` : t('workstation.unavailable')}</Typography>
        <Typography variant="caption">{t('officialContext.source')} · {item?.observationDate ?? '—'} · {t(`workstation.freshness.${item?.freshness === 'STALE' || query.isError ? 'STALE' : item?.value != null ? 'CLOSE' : 'UNAVAILABLE'}`)}</Typography>
        {item?.retrievedAt && <Typography variant="caption">{t('workstation.retrievedAt')}: {new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.retrievedAt))} · {timezone}</Typography>}
        {item?.availabilityReason && <Typography variant="caption">{t(`workstation.availability.${item.availabilityReason}`)}</Typography>}
      </Stack>
    })}
    <Link href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noreferrer">{t('workstation.source')} · ECB</Link>
  </WorkstationCard>
}
