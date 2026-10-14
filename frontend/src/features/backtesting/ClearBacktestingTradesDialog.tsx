import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { deleteBacktestingWorkspaceTrades } from '../../api/backtesting'
import { useI18n } from '../../i18n'

export default function ClearBacktestingTradesDialog({ workspaceId, workspaceName, tradeCount, autoImportEnabled, onClose, onCleared }: {
  workspaceId: string; workspaceName: string; tradeCount: number; autoImportEnabled: boolean
  onClose: () => void; onCleared: () => Promise<void>
}) {
  const { t } = useI18n()
  const [confirmation, setConfirmation] = useState('')
  const word = t('backtesting.clearTrades.confirmationWord')
  const mutation = useMutation({ mutationFn: () => deleteBacktestingWorkspaceTrades(workspaceId), onSuccess: onCleared })
  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isLoading ? undefined : onClose} aria-labelledby="clear-backtesting-trades-title">
    <DialogTitle id="clear-backtesting-trades-title">{t('backtesting.clearTrades.title')}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Typography sx={{ overflowWrap: 'anywhere' }}>{t('backtesting.clearTrades.scope', { name: workspaceName, count: tradeCount })}</Typography>
      <Alert severity="warning">{t('backtesting.clearTrades.consequences')}</Alert>
      {autoImportEnabled && <Typography variant="body2" color="text.secondary">{t('backtesting.clearTrades.autoImport')}</Typography>}
      {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : t('backtesting.clearTrades.error')}</Alert>}
      <TextField autoFocus fullWidth label={t('backtesting.clearTrades.confirmationLabel', { word })} value={confirmation}
        disabled={mutation.isLoading} onChange={event => setConfirmation(event.target.value)} autoComplete="off" />
    </Stack></DialogContent>
    <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }}><Button disabled={mutation.isLoading} onClick={onClose}>{t('backtesting.actions.cancel')}</Button>
      <Button color="error" variant="contained" disabled={mutation.isLoading || tradeCount === 0 || confirmation !== word}
        onClick={() => mutation.mutate()}>{t(mutation.isLoading ? 'backtesting.clearTrades.deleting' : 'backtesting.clearTrades.action')}</Button>
    </DialogActions>
  </Dialog>
}
