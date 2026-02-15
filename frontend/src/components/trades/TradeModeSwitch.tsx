import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useI18n } from '../../i18n'

export type TradeEntryMode = 'quick' | 'advanced'

type TradeModeSwitchProps = {
  value: TradeEntryMode
  onChange: (mode: TradeEntryMode) => void
}

export function TradeModeSwitch({ value, onChange }: TradeModeSwitchProps) {
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
    >
      <ToggleButton value="quick">{t('trades.form.modes.quick')}</ToggleButton>
      <ToggleButton value="advanced">{t('trades.form.modes.advanced')}</ToggleButton>
    </ToggleButtonGroup>
  )
}
