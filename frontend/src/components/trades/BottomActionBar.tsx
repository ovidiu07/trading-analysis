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
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: { xs: 2, md: 3 },
        pt: 1.25,
        pb: mobileSticky ? 'calc(env(safe-area-inset-bottom) + 12px)' : 1.5,
        position: mobileSticky ? 'sticky' : 'static',
        bottom: 0,
        zIndex: 4
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

