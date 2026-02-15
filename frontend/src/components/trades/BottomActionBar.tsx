import { Box, Button, Stack } from '@mui/material'
import { ReactNode } from 'react'
import { useI18n } from '../../i18n'

type BottomActionBarProps = {
  submitLabel: string
  submitDisabled?: boolean
  submitting?: boolean
  onCancel?: () => void
  mobileSticky?: boolean
  extraContent?: ReactNode
}

export function BottomActionBar({
  submitLabel,
  submitDisabled = false,
  submitting = false,
  onCancel,
  mobileSticky = false,
  extraContent
}: BottomActionBarProps) {
  const { t } = useI18n()

  return (
    <Box
      data-testid="trade-create-action-bar"
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: { xs: 2, md: 3 },
        pt: 1.25,
        pb: mobileSticky ? 'calc(env(safe-area-inset-bottom) + 12px)' : 'max(12px, env(safe-area-inset-bottom))',
        position: mobileSticky ? 'sticky' : 'relative',
        bottom: mobileSticky ? 0 : 'auto',
        zIndex: mobileSticky ? 7 : 4,
        boxShadow: mobileSticky ? '0 -8px 18px rgba(0, 0, 0, 0.08)' : 'none',
        flexShrink: 0
      }}
    >
      <Stack spacing={1}>
        {extraContent}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={submitDisabled || submitting}
          >
            {submitLabel}
          </Button>
          {onCancel && (
            <Button
              variant={mobileSticky ? 'text' : 'outlined'}
              fullWidth={mobileSticky}
              onClick={onCancel}
            >
              {t('common.cancel')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}
