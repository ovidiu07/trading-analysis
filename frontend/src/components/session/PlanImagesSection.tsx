import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Typography
} from '@mui/material'
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import type { PlanImage } from '../../api/liveWorkspace'
import AssetThumbnail from '../assets/AssetThumbnail'
import AssetUploadDropzone from '../assets/AssetUploadDropzone'
import SecureAssetImage from '../assets/SecureAssetImage'
import type { UploadQueueItem } from '../assets/AssetListRenderer'
import { formatFileSize } from '../../utils/format'
import { useI18n } from '../../i18n'

type PlanImagesSectionProps = {
  compact?: boolean
  title: string
  storageLabel: string
  images: PlanImage[]
  uploads: UploadQueueItem[]
  disabled?: boolean
  disabledReason?: string
  deletingIds?: Set<string>
  onUpload: (files: File[]) => void
  onDelete: (image: PlanImage) => void
  onRetry?: () => void
  onOpenCalendar: () => void
}

export default function PlanImagesSection({
  compact = false,
  title,
  storageLabel,
  images,
  uploads,
  disabled = false,
  disabledReason,
  deletingIds = new Set(),
  onUpload,
  onDelete,
  onRetry,
  onOpenCalendar
}: PlanImagesSectionProps) {
  const { t } = useI18n()
  const [activeIndex, setActiveIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const hasMultiple = images.length > 1
  const activeImage = images[activeIndex] || null

  useEffect(() => {
    setActiveIndex((current) => {
      if (images.length === 0) return 0
      return Math.min(current, images.length - 1)
    })
  }, [images.length])

  const goPrevious = () => {
    if (!images.length) return
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1))
  }

  const goNext = () => {
    if (!images.length) return
    setActiveIndex((current) => (current === images.length - 1 ? 0 : current + 1))
  }

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX.current == null || !hasMultiple) return
    const delta = clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 36) return
    if (delta > 0) {
      goPrevious()
    } else {
      goNext()
    }
  }

  if (compact) {
    return (
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <ImageOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{title}</Typography>
            {images.length > 0 ? <Chip size="small" label={images.length} /> : null}
          </Stack>
          <Button component="label" variant="outlined" size="small" disabled={disabled}>
            {t('today.session.simple.plans.images.addScreenshots')}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(event) => {
                onUpload(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
          </Button>
        </Stack>
        {disabled && disabledReason ? <Typography variant="caption" color="text.secondary">{disabledReason}</Typography> : null}
        {uploads.length > 0 ? (
          <Stack spacing={0.5}>
            {uploads.map((upload) => (
              <Box key={upload.id}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="caption" noWrap>{upload.fileName}</Typography>
                  <Typography variant="caption" color={upload.error ? 'error.main' : 'text.secondary'}>{upload.error || `${upload.progress}%`}</Typography>
                </Stack>
                <LinearProgress color={upload.error ? 'error' : 'primary'} variant="determinate" value={upload.error ? 100 : Math.max(2, upload.progress)} />
              </Box>
            ))}
          </Stack>
        ) : null}
        {images.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', maxWidth: '100%', pb: 0.5 }}>
            {images.map((image, index) => (
              <Box key={image.id} sx={{ position: 'relative', flex: '0 0 auto' }}>
                <ButtonBase onClick={() => setActiveIndex(index)} aria-label={t('today.session.simple.plans.images.open', { index: index + 1 })} sx={{ borderRadius: 1, border: '1px solid', borderColor: index === activeIndex ? 'primary.main' : 'divider', p: 0.35 }}>
                  <AssetThumbnail url={image.thumbnailUrl || image.viewUrl || image.url || image.downloadUrl} alt={image.originalFileName || t('today.session.simple.plans.images.open', { index: index + 1 })} />
                </ButtonBase>
                <IconButton
                  size="small"
                  aria-label={t('today.session.simple.plans.images.remove', { index: index + 1 })}
                  disabled={deletingIds.has(image.id)}
                  onClick={() => onDelete(image)}
                  sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        ) : null}
      </Stack>
    )
  }

  return (
    <Box className="ws-subpanel" sx={{ p: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
      <Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
          <Stack spacing={0.45} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <ImageOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{title}</Typography>
              <Chip size="small" label={t('today.session.simple.plans.images.count', { count: images.length })} />
            </Stack>
            <Typography variant="body2" color="text.secondary">{storageLabel}</Typography>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewRoundedIcon />}
            onClick={onOpenCalendar}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
          >
            {t('today.session.simple.plans.images.openCalendar')}
          </Button>
        </Stack>

        {disabled && disabledReason ? (
          <Alert severity="info">{disabledReason}</Alert>
        ) : (
          <AssetUploadDropzone
            title={t('today.session.simple.plans.images.dropTitle')}
            hint={t('today.session.simple.plans.images.dropHint')}
            buttonLabel={t('today.session.simple.plans.images.upload')}
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            disabled={disabled}
            onFilesSelected={onUpload}
          />
        )}

        {uploads.length > 0 && (
          <Stack spacing={0.75}>
            {uploads.map((upload) => (
              <Box key={upload.id} sx={{ p: 1, border: '1px solid', borderColor: upload.error ? 'error.main' : 'divider', borderRadius: 1 }}>
                <Stack spacing={0.6}>
                  <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{upload.fileName}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatFileSize(upload.sizeBytes)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={Math.max(2, upload.progress)} />
                  {upload.error ? <Typography variant="caption" color="error.main">{upload.error}</Typography> : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        {images.length === 0 ? (
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('today.session.simple.plans.images.empty')}</Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            <Box
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') goPrevious()
                if (event.key === 'ArrowRight') goNext()
              }}
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0]?.clientX ?? null
              }}
              onTouchEnd={(event) => {
                handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
              }}
              sx={{
                position: 'relative',
                minWidth: 0,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                outline: 'none',
                '&:focus-visible': {
                  boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}33`
                }
              }}
            >
              <Box sx={{ aspectRatio: { xs: '4 / 3', md: '16 / 9' }, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
                {activeImage ? (
                  <SecureAssetImage
                    url={activeImage.viewUrl || activeImage.url || activeImage.downloadUrl}
                    alt={activeImage.originalFileName || t('today.session.simple.plans.images.alt')}
                    fallback={(
                      <Stack alignItems="center" spacing={1} sx={{ p: 2 }}>
                        <BrokenImageOutlinedIcon />
                        <Typography variant="body2" color="text.secondary" textAlign="center">{t('today.session.simple.plans.images.loadFailed')}</Typography>
                        {onRetry ? (
                          <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={onRetry}>{t('common.retry')}</Button>
                        ) : null}
                      </Stack>
                    )}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                ) : null}
              </Box>

              {hasMultiple ? (
                <>
                  <IconButton
                    aria-label={t('today.session.simple.plans.images.previous')}
                    onClick={goPrevious}
                    sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                  >
                    <NavigateBeforeRoundedIcon />
                  </IconButton>
                  <IconButton
                    aria-label={t('today.session.simple.plans.images.next')}
                    onClick={goNext}
                    sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                  >
                    <NavigateNextRoundedIcon />
                  </IconButton>
                </>
              ) : null}

              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ position: 'absolute', left: 8, bottom: 8, right: 8, justifyContent: 'space-between', minWidth: 0 }}
              >
                <Chip size="small" label={`${activeIndex + 1} / ${images.length}`} sx={{ bgcolor: 'background.paper' }} />
                {activeImage ? (
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    disabled={deletingIds.has(activeImage.id)}
                    onClick={() => onDelete(activeImage)}
                  >
                    {t('today.session.simple.plans.images.delete')}
                  </Button>
                ) : null}
              </Stack>
            </Box>

            {hasMultiple ? (
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, maxWidth: '100%' }}>
                {images.map((image, index) => (
                  <ButtonBase
                    key={image.id}
                    onClick={() => setActiveIndex(index)}
                    aria-label={t('today.session.simple.plans.images.open', { index: index + 1 })}
                    sx={{
                      flex: '0 0 auto',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: index === activeIndex ? 'primary.main' : 'divider',
                      p: 0.35,
                      bgcolor: index === activeIndex ? 'action.selected' : 'background.paper'
                    }}
                  >
                    <AssetThumbnail
                      url={image.thumbnailUrl || image.viewUrl || image.url || image.downloadUrl}
                      alt={image.originalFileName || t('today.session.simple.plans.images.open', { index: index + 1 })}
                    />
                  </ButtonBase>
                ))}
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
