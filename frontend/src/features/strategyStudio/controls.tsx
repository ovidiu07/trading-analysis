import { IconButton, Stack, Tooltip } from '@mui/material'
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { useStudioText } from './labels'
export function ItemActions({
  index,
  count,
  onMove,
  onDuplicate,
  onDelete,
  deleteDisabled = false
}: {
  index: number
  count: number
  onMove: (offset: number) => void
  onDuplicate?: () => void
  onDelete: () => void
  deleteDisabled?: boolean
}) {
  const s = useStudioText()
  return (
    <Stack
      direction="row"
      spacing={0.25}
      sx={{ '& .MuiIconButton-root': { minWidth: { xs: 44, sm: 32 }, minHeight: { xs: 44, sm: 32 } } }}
    >
      <Tooltip title={s('Move up')}>
        <span>
          <IconButton size="small" aria-label={s('Move up')} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUpwardRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={s('Move down')}>
        <span>
          <IconButton size="small" aria-label={s('Move down')} disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDownwardRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {onDuplicate && (
        <Tooltip title={s('Duplicate')}>
          <IconButton size="small" aria-label={s('Duplicate')} onClick={onDuplicate}>
            <ContentCopyRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={deleteDisabled ? s('Referenced by a rule or preset') : s('Delete')}>
        <span>
          <IconButton size="small" aria-label={s('Delete')} disabled={deleteDisabled} onClick={onDelete}>
            <DeleteOutlineRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )
}
