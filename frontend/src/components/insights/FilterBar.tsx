import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import TuneIcon from '@mui/icons-material/Tune'
import CloseIcon from '@mui/icons-material/Close'
import { useI18n } from '../../i18n'

export type FilterTypeOption = {
  key: string
  label: string
}

type FilterBarProps = {
  search: string
  tagFilter: string
  symbolFilter: string
  secondaryType: string
  secondaryTypeOptions: FilterTypeOption[]
  onSearchChange: (value: string) => void
  onTagFilterChange: (value: string) => void
  onSymbolFilterChange: (value: string) => void
  onSecondaryTypeChange: (value: string) => void
  onReset: () => void
}

export default function FilterBar({
  search,
  tagFilter,
  symbolFilter,
  secondaryType,
  secondaryTypeOptions,
  onSearchChange,
  onTagFilterChange,
  onSymbolFilterChange,
  onSecondaryTypeChange,
  onReset
}: FilterBarProps) {
  const { t } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const secondaryOptions = useMemo(() => [
    { key: '', label: t('insights.filters.anySecondary') },
    ...secondaryTypeOptions
  ], [secondaryTypeOptions, t])

  if (isMobile) {
    return (
      <>
        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          <TextField
            fullWidth
            placeholder={t('insights.searchPlaceholder')}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            inputProps={{ 'aria-label': t('insights.searchPlaceholder') }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={() => setMobileFiltersOpen(true)}
            fullWidth
            sx={{ minHeight: 44 }}
          >
            {t('dashboard.topBar.filters')}
          </Button>
        </Stack>

        <Drawer
          anchor="bottom"
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          ModalProps={{ keepMounted: false }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              width: '100%',
              maxWidth: '100vw',
              px: 2,
              pt: 1.5,
              pb: 'calc(16px + env(safe-area-inset-bottom))',
              borderTop: '1px solid',
              borderColor: 'divider',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '85dvh',
              overflowX: 'hidden',
              overflowY: 'auto'
            }
          }}
        >
          <Stack spacing={1.5} sx={{ minWidth: 0, height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t('dashboard.topBar.filters')}
              </Typography>
              <IconButton
                onClick={() => setMobileFiltersOpen(false)}
                aria-label={t('dashboard.topBar.closeFilters')}
                sx={{ width: 44, height: 44 }}
              >
                <CloseIcon />
              </IconButton>
            </Stack>

            <TextField
              fullWidth
              placeholder={t('insights.tagsPlaceholder')}
              value={tagFilter}
              onChange={(event) => onTagFilterChange(event.target.value)}
              inputProps={{ 'aria-label': t('insights.tagsPlaceholder') }}
            />

            <TextField
              fullWidth
              placeholder={t('insights.symbolsPlaceholder')}
              value={symbolFilter}
              onChange={(event) => onSymbolFilterChange(event.target.value)}
              inputProps={{ 'aria-label': t('insights.symbolsPlaceholder') }}
            />

            <TextField
              select
              fullWidth
              value={secondaryType}
              onChange={(event) => onSecondaryTypeChange(event.target.value)}
              inputProps={{ 'aria-label': t('insights.filters.secondaryType') }}
              label={t('insights.filters.secondaryType')}
            >
              {secondaryOptions.map((option) => (
                <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
              ))}
            </TextField>

            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" fullWidth onClick={onReset}>
                {t('common.reset')}
              </Button>
              <Button variant="contained" fullWidth onClick={() => setMobileFiltersOpen(false)}>
                {t('common.apply')}
              </Button>
            </Stack>
          </Stack>
        </Drawer>
      </>
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))', md: '2fr 1fr 1fr 1fr' },
        gap: 1.5,
        alignItems: 'center',
        minWidth: 0,
        '& > *': { minWidth: 0 }
      }}
    >
      <TextField
        fullWidth
        placeholder={t('insights.searchPlaceholder')}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}
        inputProps={{ 'aria-label': t('insights.searchPlaceholder') }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />

      <TextField
        fullWidth
        placeholder={t('insights.tagsPlaceholder')}
        value={tagFilter}
        onChange={(event) => onTagFilterChange(event.target.value)}
        inputProps={{ 'aria-label': t('insights.tagsPlaceholder') }}
      />

      <TextField
        fullWidth
        placeholder={t('insights.symbolsPlaceholder')}
        value={symbolFilter}
        onChange={(event) => onSymbolFilterChange(event.target.value)}
        inputProps={{ 'aria-label': t('insights.symbolsPlaceholder') }}
      />

      <TextField
        select
        fullWidth
        value={secondaryType}
        onChange={(event) => onSecondaryTypeChange(event.target.value)}
        inputProps={{ 'aria-label': t('insights.filters.secondaryType') }}
        label={t('insights.filters.secondaryType')}
      >
        {secondaryOptions.map((option) => (
          <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
        ))}
      </TextField>
    </Box>
  )
}
