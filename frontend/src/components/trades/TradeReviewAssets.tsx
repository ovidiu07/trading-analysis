import { useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, listTradeAssets, uploadAsset } from '../../api/assets'
import SecureAssetImage from '../assets/SecureAssetImage'
import { useI18n } from '../../i18n'

/** Uses the existing owned trade asset lifecycle without modifying execution economics. */
export default function TradeReviewAssets({ tradeId }: { tradeId: string }) {
  const { t } = useI18n()
  const assets = useQuery({ queryKey: ['tradeAssets', tradeId], queryFn: () => listTradeAssets(tradeId) })
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [validation, setValidation] = useState('')
  const upload = async () => {
    if (!file) return
    setState('saving')
    try { await uploadAsset({ file, scope: 'TRADE', tradeId }); setFile(null); setState('saved'); await assets.refetch() }
    catch { setState('error') }
  }
  return <Stack spacing={1}>
    <Typography component="h3" variant="subtitle2">{t('dailyReview.screenshots')}</Typography>
    {assets.isError && <Alert severity="error" action={<Button onClick={() => void assets.refetch()}>{t('dailyReview.retry')}</Button>}>{t('dailyReview.loadError')}</Alert>}
    {assets.data?.filter(asset => asset.image || asset.contentType?.startsWith('image/')).map(asset => <SecureAssetImage key={asset.id} url={asset.viewUrl || asset.url || asset.downloadUrl} alt={asset.originalFileName} sx={{ width: '100%', maxHeight: 360, objectFit: 'contain' }} fallback={<Typography>{t('dailyReview.loadError')}</Typography>} />)}
    <Button component="label" disabled={state === 'saving'}>{t('dailyReview.addScreenshot')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} aria-label={t('dailyReview.addScreenshot')} onChange={event => {
      const selected = event.target.files?.[0]; event.target.value = ''
      if (!selected) return
      if (!ALLOWED_IMAGE_MIME_TYPES.has(selected.type) || selected.size > MAX_UPLOAD_SIZE_BYTES) { setValidation(t('dailyReview.imageValidation')); return }
      setValidation(''); setFile(selected); setState('idle')
    }} /></Button>
    {validation && <Alert severity="error">{validation}</Alert>}
    {file && <><Typography variant="caption">{file.name}</Typography><Button disabled={state === 'saving'} onClick={() => void upload()}>{t(state === 'error' ? 'dailyReview.retry' : 'dailyReview.uploadScreenshot')}</Button></>}
    {state !== 'idle' && <Typography role="status">{t(`dailyReview.save.${state}`)}</Typography>}
  </Stack>
}
