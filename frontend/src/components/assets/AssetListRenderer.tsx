import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined'
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material'
import type { AssetItem } from '../../api/assets'
import { formatFileSize } from '../../utils/format'
import AssetThumbnail from './AssetThumbnail'

export type UploadQueueItem = {
  id: string
  fileName: string
  sizeBytes: number
  progress: number
  error?: string
}

type AssetListRendererProps = {
  assets: AssetItem[]
  uploads?: UploadQueueItem[]
  emptyText: string
  onCopyLink?: (asset: AssetItem) => void
  onRemove?: (asset: AssetItem) => void
  onInsert?: (asset: AssetItem) => void
  onDownload?: (asset: AssetItem) => void
  onImageError?: () => void
  copyLabel?: string
  removeLabel?: string
  insertLabel?: string
  downloadLabel?: string
}

const contentTypeLabel = (asset: AssetItem) => {
  if (!asset.contentType) return ''
  return asset.contentType
}

export default function AssetListRenderer({
  assets,
  uploads = [],
  emptyText,
  onCopyLink,
  onRemove,
  onInsert,
  onDownload,
  onImageError,
  copyLabel,
  removeLabel,
  insertLabel,
  downloadLabel
}: AssetListRendererProps) {
  if (uploads.length === 0 && assets.length === 0) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
  }

  return (
    <Stack spacing={1.25}>
      {uploads.map((upload) => (
        <Paper key={upload.id} variant="outlined" sx={{ p: 1.25 }}>
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{upload.fileName}</Typography>
              <Typography variant="caption" color="text.secondary">{formatFileSize(upload.sizeBytes)}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.max(2, upload.progress)} />
            {upload.error && (
              <Typography variant="caption" color="error.main">{upload.error}</Typography>
            )}
          </Stack>
        </Paper>
      ))}

      {assets.map((asset) => {
        const isImage = Boolean(asset.image)
        return (
          <Paper key={asset.id} variant="outlined" sx={{ p: 1.25 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
                {isImage ? (
                  <AssetThumbnail
                    url={asset.thumbnailUrl || asset.viewUrl || asset.url}
                    alt={asset.originalFileName}
                    onLoadError={onImageError}
                  />
                ) : (
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                      width: 92,
                      height: 64,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      color: 'text.secondary',
                      backgroundColor: 'background.default'
                    }}
                  >
                    <InsertDriveFileOutlinedIcon fontSize="small" />
                  </Stack>
                )}

                <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                    {isImage ? <ImageOutlinedIcon sx={{ fontSize: 16 }} color="action" /> : <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} color="action" />}
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{asset.originalFileName}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    {formatFileSize(asset.sizeBytes)}{contentTypeLabel(asset) ? ` • ${contentTypeLabel(asset)}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
                    {(asset.url || asset.downloadUrl || asset.viewUrl || '').replace(/^https?:\/\//, '')}
                  </Typography>
                </Stack>
              </Stack>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {onDownload && (
                  <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon fontSize="small" />} onClick={() => onDownload(asset)}>
                    {downloadLabel}
                  </Button>
                )}
                {onCopyLink && (
                  <Button size="small" variant="text" startIcon={<ContentCopyOutlinedIcon fontSize="small" />} onClick={() => onCopyLink(asset)}>
                    {copyLabel}
                  </Button>
                )}
                {onInsert && (
                  <Button size="small" variant="text" startIcon={<NoteAddOutlinedIcon fontSize="small" />} onClick={() => onInsert(asset)}>
                    {insertLabel}
                  </Button>
                )}
                {onRemove && (
                  <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />} onClick={() => onRemove(asset)}>
                    {removeLabel}
                  </Button>
                )}
              </Box>
            </Stack>
          </Paper>
        )
      })}
    </Stack>
  )
}
