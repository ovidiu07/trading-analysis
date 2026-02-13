import {
  Box,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import TuneIcon from '@mui/icons-material/Tune'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PushPinIcon from '@mui/icons-material/PushPin'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import LinkIcon from '@mui/icons-material/Link'
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'
import { NotebookNote } from '../../api/notebook'
import { useI18n } from '../../i18n'
import { formatDateTime } from '../../utils/format'
import EmptyState from '../ui/EmptyState'
import { extractPlainText, extractSymbolsFromNote, resolveNoteHtml } from './noteContent'
import { NoteSortOrder } from './types'

type FilterChip = {
  id: string
  label: string
  onDelete: () => void
}

type NoteListProps = {
  notes: NotebookNote[]
  loading: boolean
  selectedNoteId?: string
  timezone: string
  searchQuery: string
  onSearchChange: (value: string) => void
  sortOrder: NoteSortOrder
  onSortChange: (value: NoteSortOrder) => void
  appliedFilterChips: FilterChip[]
  onOpenNavigation?: () => void
  onOpenFilters: () => void
  onSelectNote: (note: NotebookNote) => void
  newMenu: ReactNode
  listCollapsed?: boolean
  onToggleCollapsed?: () => void
}

export default function NoteList({
  notes,
  loading,
  selectedNoteId,
  timezone,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  appliedFilterChips,
  onOpenNavigation,
  onOpenFilters,
  onSelectNote,
  newMenu,
  listCollapsed = false,
  onToggleCollapsed
}: NoteListProps) {
  const { t } = useI18n()
  const listRef = useRef<HTMLUListElement | null>(null)

  const noteTypeLabels = useMemo(() => ({
    DAILY_LOG: t('notebook.noteType.DAILY_LOG'),
    TRADE_NOTE: t('notebook.noteType.TRADE_NOTE'),
    PLAN: t('notebook.noteType.PLAN'),
    GOAL: t('notebook.noteType.GOAL'),
    SESSION_RECAP: t('notebook.noteType.SESSION_RECAP'),
    NOTE: t('notebook.noteType.NOTE')
  }), [t])

  const handleKeyboardNavigation = (direction: 'up' | 'down') => {
    if (notes.length === 0) return
    const currentIndex = notes.findIndex((note) => note.id === selectedNoteId)
    const nextIndex = direction === 'down'
      ? Math.min(currentIndex + 1, notes.length - 1)
      : Math.max(currentIndex - 1, 0)
    const target = currentIndex === -1 ? notes[0] : notes[nextIndex]
    if (target) {
      onSelectNote(target)
    }
  }

  return (
    <Stack sx={{ minHeight: 0, height: '100%' }}>
      <Stack
        spacing={1.25}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          {newMenu}
          <Stack direction="row" spacing={0.5}>
            {onOpenNavigation && (
              <IconButton
                onClick={onOpenNavigation}
                aria-label={t('notebook.aria.openNavigation')}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <FolderOpenIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              onClick={onOpenFilters}
              aria-label={t('notebook.aria.openFilters')}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <TuneIcon fontSize="small" />
            </IconButton>
            {onToggleCollapsed && (
              <IconButton
                onClick={onToggleCollapsed}
                aria-label={listCollapsed ? t('notebook.actions.expandList') : t('notebook.actions.collapseList')}
              >
                {listCollapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowLeftIcon fontSize="small" />}
              </IconButton>
            )}
          </Stack>
        </Stack>

        {!listCollapsed && (
          <>
            <TextField
              size="small"
              placeholder={t('notebook.placeholders.searchNotes')}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />

            <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.25 }}>
              {appliedFilterChips.map((chip) => (
                <Chip key={chip.id} label={chip.label} size="small" onDelete={chip.onDelete} />
              ))}
              {appliedFilterChips.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ py: 0.75 }}>
                  {t('notebook.labels.noActiveFilters')}
                </Typography>
              )}
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <TextField
                select
                size="small"
                label={t('notebook.fields.sort')}
                value={sortOrder}
                onChange={(event) => onSortChange(event.target.value as NoteSortOrder)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="updated">{t('notebook.sort.updated')}</MenuItem>
                <MenuItem value="created">{t('notebook.sort.created')}</MenuItem>
                <MenuItem value="date">{t('notebook.sort.noteDate')}</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary">
                {t('notebook.labels.notesCount', { count: notes.length })}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>

      {listCollapsed ? (
        <Stack sx={{ flex: 1, minHeight: 0 }} alignItems="center" justifyContent="center">
          <Typography variant="caption" color="text.secondary">{t('notebook.labels.listCollapsed')}</Typography>
        </Stack>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}>
          {loading && (
            <Stack spacing={1}>
              <Skeleton variant="rounded" height={72} />
              <Skeleton variant="rounded" height={72} />
              <Skeleton variant="rounded" height={72} />
            </Stack>
          )}

          {!loading && notes.length === 0 && (
            <EmptyState title={t('notebook.empty.noNotesTitle')} description={t('notebook.empty.noNotesBody')} />
          )}

          {!loading && notes.length > 0 && (
            <List
              ref={listRef}
              disablePadding
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  handleKeyboardNavigation('down')
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  handleKeyboardNavigation('up')
                }
              }}
              sx={{ outline: 'none' }}
              tabIndex={0}
            >
              {notes.map((note, index) => {
                const previewSource = resolveNoteHtml(note)
                const excerpt = previewSource ? extractPlainText(previewSource).replace(/\s+/g, ' ').trim() : ''
                const symbols = extractSymbolsFromNote(note)
                return (
                  <Box key={note.id}>
                    <ListItemButton
                      selected={selectedNoteId === note.id}
                      onClick={() => onSelectNote(note)}
                      sx={{
                        alignItems: 'flex-start',
                        borderRadius: 2,
                        py: 1.25,
                        px: 1.25
                      }}
                    >
                      <Stack spacing={0.6} sx={{ width: '100%' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }} noWrap>
                            {note.title || t('notebook.defaultTitle.untitledNote')}
                          </Typography>
                          {note.isPinned && <PushPinIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                        </Stack>

                        <Typography variant="body2" color="text.secondary" noWrap>
                          {excerpt || t('notebook.empty.emptyPreview')}
                        </Typography>

                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          <Chip size="small" variant="outlined" label={noteTypeLabels[note.type]} />
                          {note.relatedTradeId && <Chip size="small" icon={<LinkIcon />} label={t('notebook.labels.linkedTradeShort')} />}
                          {note.hasAttachments && <Chip size="small" icon={<AttachFileIcon />} label={t('notebook.labels.attachmentsShort')} />}
                          {symbols.map((symbol) => (
                            <Chip key={`${note.id}-${symbol}`} size="small" label={symbol} />
                          ))}
                        </Stack>

                        <Typography variant="caption" color="text.secondary">
                          {t('notebook.labels.updatedAt', {
                            date: note.updatedAt ? formatDateTime(note.updatedAt, timezone) : t('notebook.labels.notAvailable')
                          })}
                        </Typography>
                      </Stack>
                    </ListItemButton>
                    {index < notes.length - 1 && <Divider sx={{ my: 0.5 }} />}
                  </Box>
                )
              })}
            </List>
          )}
        </Box>
      )}
    </Stack>
  )
}
