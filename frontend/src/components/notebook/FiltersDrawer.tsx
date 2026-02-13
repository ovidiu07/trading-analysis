import { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import { NotebookFolder, NotebookTag } from '../../api/notebook'
import { useI18n } from '../../i18n'
import { AdvancedNoteFilters } from './types'

type FiltersDrawerProps = {
  open: boolean
  onClose: () => void
  isMobile: boolean
  filters: AdvancedNoteFilters
  tags: NotebookTag[]
  folders: NotebookFolder[]
  onApply: (next: AdvancedNoteFilters) => void
  onReset: () => void
}

const defaultDraft: AdvancedNoteFilters = {
  folderId: '',
  type: 'ALL',
  tagIds: [],
  from: '',
  to: '',
  linkedTrade: 'ALL',
  hasAttachments: 'ALL'
}

export default function FiltersDrawer({
  open,
  onClose,
  isMobile,
  filters,
  tags,
  folders,
  onApply,
  onReset
}: FiltersDrawerProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<AdvancedNoteFilters>(filters)

  useEffect(() => {
    if (open) {
      setDraft(filters)
    }
  }, [filters, open])

  const folderOptions = useMemo(() => folders.filter((folder) => !folder.systemKey), [folders])
  const selectedTags = useMemo(() => tags.filter((tag) => draft.tagIds.includes(tag.id)), [draft.tagIds, tags])

  const handleApply = () => {
    onApply(draft)
    onClose()
  }

  const handleReset = () => {
    setDraft(defaultDraft)
    onReset()
    onClose()
  }

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 380,
          height: isMobile ? '85dvh' : '100%',
          borderTopLeftRadius: isMobile ? 20 : 0,
          borderTopRightRadius: isMobile ? 20 : 0
        }
      }}
    >
      <Stack spacing={2} sx={{ p: 2, minHeight: 0, height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight={700}>{t('notebook.sections.filters')}</Typography>
          <IconButton onClick={onClose} aria-label={t('notebook.aria.closeFilters')} sx={isMobile ? { minWidth: 44, minHeight: 44 } : undefined}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
          <TextField
            select
            label={t('notebook.fields.folder')}
            value={draft.folderId}
            onChange={(event) => setDraft((prev) => ({ ...prev, folderId: event.target.value }))}
          >
            <MenuItem value="">{t('common.all')}</MenuItem>
            {folderOptions.map((folder) => (
              <MenuItem key={folder.id} value={folder.id}>{folder.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label={t('notebook.fields.type')}
            value={draft.type}
            onChange={(event) => setDraft((prev) => ({ ...prev, type: event.target.value as AdvancedNoteFilters['type'] }))}
          >
            <MenuItem value="ALL">{t('common.all')}</MenuItem>
            <MenuItem value="DAILY_LOG">{t('notebook.noteType.DAILY_LOG')}</MenuItem>
            <MenuItem value="TRADE_NOTE">{t('notebook.noteType.TRADE_NOTE')}</MenuItem>
            <MenuItem value="PLAN">{t('notebook.noteType.PLAN')}</MenuItem>
            <MenuItem value="GOAL">{t('notebook.noteType.GOAL')}</MenuItem>
            <MenuItem value="SESSION_RECAP">{t('notebook.noteType.SESSION_RECAP')}</MenuItem>
            <MenuItem value="NOTE">{t('notebook.noteType.NOTE')}</MenuItem>
          </TextField>

          <Autocomplete
            multiple
            options={tags}
            value={selectedTags}
            onChange={(_, value) => setDraft((prev) => ({ ...prev, tagIds: value.map((item) => item.id) }))}
            getOptionLabel={(option) => option.name}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option.name} {...getTagProps({ index })} key={option.id} size="small" />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} label={t('notebook.fields.tags')} placeholder={t('notebook.placeholders.filterByTag')} />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label={t('notebook.fields.from')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={draft.from}
              onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
              fullWidth
            />
            <TextField
              label={t('notebook.fields.to')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={draft.to}
              onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
              fullWidth
            />
          </Stack>

          <TextField
            select
            label={t('notebook.fields.linkedTrade')}
            value={draft.linkedTrade}
            onChange={(event) => setDraft((prev) => ({ ...prev, linkedTrade: event.target.value as AdvancedNoteFilters['linkedTrade'] }))}
          >
            <MenuItem value="ALL">{t('common.all')}</MenuItem>
            <MenuItem value="YES">{t('common.yes')}</MenuItem>
            <MenuItem value="NO">{t('common.no')}</MenuItem>
          </TextField>

          <TextField
            select
            label={t('notebook.fields.hasAttachments')}
            value={draft.hasAttachments}
            onChange={(event) => setDraft((prev) => ({ ...prev, hasAttachments: event.target.value as AdvancedNoteFilters['hasAttachments'] }))}
          >
            <MenuItem value="ALL">{t('common.all')}</MenuItem>
            <MenuItem value="YES">{t('common.yes')}</MenuItem>
            <MenuItem value="NO">{t('common.no')}</MenuItem>
          </TextField>
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
          <Button variant="outlined" onClick={handleReset} fullWidth>{t('common.reset')}</Button>
          <Button variant="contained" onClick={handleApply} fullWidth>{t('common.apply')}</Button>
        </Box>
      </Stack>
    </Drawer>
  )
}
