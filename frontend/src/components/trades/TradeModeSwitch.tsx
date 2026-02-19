import { SxProps, Theme, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useI18n } from '../../i18n'

export type TradeEntryMode = 'quick' | 'advanced'

type TradeModeSwitchProps = {
  value: TradeEntryMode
  onChange: (mode: TradeEntryMode) => void
  fullWidth?: boolean
  ariaLabel?: string
  sx?: SxProps<Theme>
}

export function TradeModeSwitch({ value, onChange, fullWidth = false, ariaLabel, sx }: TradeModeSwitchProps) {
  const { t } = useI18n()

  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_, nextValue: TradeEntryMode | null) => {
        if (!nextValue) return
        onChange(nextValue)
      }}
      size="small"
      color="primary"
      fullWidth={fullWidth}
      aria-label={ariaLabel}
      sx={{
        width: fullWidth ? '100%' : 'auto',
        minWidth: 0,
        maxWidth: '100%',
        flex: fullWidth ? '1 1 100%' : '1 1 260px',
        '& .MuiToggleButton-root': {
          flex: 1,
          minWidth: 0,
          whiteSpace: 'normal',
          lineHeight: 1.2
        },
        ...sx
      }}
    >
      <ToggleButton value="quick">{t('trades.form.modes.quick')}</ToggleButton>
      <ToggleButton value="advanced">{t('trades.form.modes.advanced')}</ToggleButton>
    </ToggleButtonGroup>
  )
}
