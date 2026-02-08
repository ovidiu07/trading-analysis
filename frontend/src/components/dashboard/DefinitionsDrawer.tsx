import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from '@mui/material'
import { useMemo } from 'react'
import { useI18n } from '../../i18n'

type DefinitionsDrawerProps = {
  open: boolean
  onClose: () => void
}

type DefinitionRow = {
  label: string
  description: string
}

export default function DefinitionsDrawer({ open, onClose }: DefinitionsDrawerProps) {
  const { t } = useI18n()

  const sections = useMemo<{ title: string; rows: DefinitionRow[] }[]>(() => ([
    {
      title: t('dashboard.help.kpiSection'),
      rows: [
        { label: t('dashboard.kpis.netPnl'), description: t('dashboard.help.kpiNetGross') },
        { label: t('dashboard.kpis.grossPnl'), description: t('dashboard.help.kpiNetGross') },
        { label: t('dashboard.kpis.winRate'), description: t('dashboard.help.kpiWinRate') },
        { label: t('dashboard.kpis.profitFactor'), description: t('dashboard.help.kpiProfitFactor') },
        { label: t('dashboard.kpis.expectancy'), description: t('dashboard.help.kpiExpectancy') },
        { label: t('dashboard.kpis.maxDrawdown'), description: t('dashboard.help.kpiDrawdown') },
      ]
    },
    {
      title: t('dashboard.help.chartsSection'),
      rows: [
        { label: t('dashboard.equityCurve.title'), description: t('dashboard.help.chartEquityCurve') },
        { label: t('dashboard.dailyPnl.title'), description: t('dashboard.help.chartDailyPnl') },
        { label: t('dashboard.recentTrades.title'), description: t('dashboard.help.chartRecentTrades') },
      ]
    }
  ]), [t])

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, p: 0 } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
        <Box>
          <Typography variant="h6">{t('dashboard.definitions.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.definitions.subtitle')}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />
      <Box sx={{ px: 2.5, py: 2, overflowY: 'auto' }}>
        <Stack spacing={2.5}>
          {sections.map((section) => (
            <Box key={section.title}>
              <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                {section.title}
              </Typography>
              <List disablePadding>
                {section.rows.map((row) => (
                  <ListItem key={row.label} disableGutters sx={{ display: 'block', py: 1 }}>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{row.label}</Typography>}
                      secondary={<Typography variant="body2" color="text.secondary">{row.description}</Typography>}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
        </Stack>
      </Box>
    </Drawer>
  )
}
