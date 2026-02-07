import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Typography
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { ApiError } from '../../api/client'
import { useDemoData } from '../../features/demo/DemoDataContext'
import { useI18n } from '../../i18n'
import { translateApiError } from '../../i18n/errorMessages'

export default function DemoDataBanner() {
  const { t } = useI18n()
  const { demoEnabled, hasDemoData, removing, removeDemoData } = useDemoData()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (!demoEnabled || !hasDemoData) {
    return null
  }

  const handleConfirmRemoval = async () => {
    try {
      await removeDemoData()
      setConfirmOpen(false)
    } catch (error) {
      const apiError = error as ApiError
      setErrorMessage(translateApiError(apiError, t, 'demo.remove.error'))
    }
  }

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'warning.light',
          backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.2),
          borderRadius: 2,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.25, sm: 1.5 },
          mb: 2
        }}
      >
        <Stack spacing={1.5} direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('demo.banner.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('demo.banner.subtitle')}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => setConfirmOpen(true)}
              disabled={removing}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {t('demo.banner.removeAction')}
            </Button>
            <Button
              variant="text"
              color="inherit"
              onClick={() => setLearnMoreOpen(true)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {t('demo.banner.learnMoreAction')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('demo.remove.confirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('demo.remove.confirmBody')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={removing}>
            {t('common.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmRemoval} disabled={removing}>
            {removing ? t('demo.remove.removing') : t('demo.banner.removeAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={learnMoreOpen} onClose={() => setLearnMoreOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('demo.learnMore.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              {t('demo.learnMore.body1')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('demo.learnMore.body2')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLearnMoreOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!errorMessage} autoHideDuration={5000} onClose={() => setErrorMessage('')}>
        <Alert severity="error" onClose={() => setErrorMessage('')} sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  )
}
