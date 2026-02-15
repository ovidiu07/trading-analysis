import { Chip, Stack } from '@mui/material'
import { TradeFormValues } from '../../utils/tradePayload'
import { useI18n } from '../../i18n'

type SessionChipsProps = {
  value?: TradeFormValues['session']
  onChange: (session?: TradeFormValues['session']) => void
}

const SESSION_OPTIONS: Array<{ value: NonNullable<TradeFormValues['session']>; labelKey: string }> = [
  { value: 'ASIA', labelKey: 'trades.form.sessions.ASIA' },
  { value: 'LONDON', labelKey: 'trades.form.sessions.LONDON' },
  { value: 'NY', labelKey: 'trades.form.sessions.NY_AM' },
  { value: 'CUSTOM', labelKey: 'trades.form.sessions.NY_PM' }
]

export function SessionChips({ value, onChange }: SessionChipsProps) {
  const { t } = useI18n()

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {SESSION_OPTIONS.map((option) => {
        const isSelected = value === option.value
        return (
          <Chip
            key={option.value}
            label={t(option.labelKey)}
            color={isSelected ? 'primary' : 'default'}
            variant={isSelected ? 'filled' : 'outlined'}
            onClick={() => onChange(isSelected ? undefined : option.value)}
          />
        )
      })}
    </Stack>
  )
}
