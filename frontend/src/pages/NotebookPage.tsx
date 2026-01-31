import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RestoreIcon from '@mui/icons-material/Restore'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import {
  NotebookAttachment,
  NotebookFolder,
  NotebookNote,
  NotebookNoteType,
  NotebookTag,
  NotebookTemplate,
  createNotebookFolder,
  createNotebookNote,
  createNotebookTag,
  createNotebookTemplate,
  deleteNotebookAttachment,
  deleteNotebookFolder,
  deleteNotebookNote,
  fetchDailySummary,
  getNotebookNote,
  listClosedTrades,
  listLosses,
  listNotebookAttachments,
  listNotebookFolders,
  listNotebookNotes,
  listNotebookTags,
  listNotebookTemplates,
  replaceNotebookNoteTags,
  restoreNotebookNote,
  updateNotebookNote,
  uploadNotebookAttachment
} from '../api/notebook'
import { formatCurrency, formatDate, formatDateTime } from '../utils/format'
import { TradeResponse, getTradeById } from '../api/trades'

type LossRecapForm = {
  from: string
  to: string
  minLoss: number
}

const defaultLossRecap: LossRecapForm = {
  from: new Date().toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  minLoss: 50
}

const buildLossRecapBody = (trades: TradeResponse[]) => {
  if (!trades.length) {
    return 'No losses matched the selected criteria.'
  }
  const rows = trades
    .map((trade) => {
      const pnl = trade.pnlNet ?? 0
      return `| ${trade.symbol} | ${trade.direction} | ${formatDateTime(trade.closedAt)} | ${pnl.toFixed(2)} | ${trade.setup ?? ''} |`
    })
    .join('\n')
  return [
    '## Loss recap',
    '',
    '| Symbol | Direction | Closed | Net P&L | Setup |',
    '| --- | --- | --- | --- | --- |',
    rows,
    '',
    '### Reflection prompts',
    '- What was the mistake?',
    '- What rule was violated?',
    '- What is the fix?'
  ].join('\n')
}

const renderSparkline = (points: number[] = []) => {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const width = 140
  const height = 36
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height}>
      <path d={path} stroke="#1976d2" strokeWidth="2" fill="none" />
    </svg>
  )
}

export default function NotebookPage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [folders, setFolders] = useState<NotebookFolder[]>([])
  const [tags, setTags] = useState<NotebookTag[]>([])
  const [notes, setNotes] = useState<NotebookNote[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNote, setSelectedNote] = useState<NotebookNote | null>(null)
  const [filterTags, setFilterTags] = useState<NotebookTag[]>([])
  const [noteTags, setNoteTags] = useState<NotebookTag[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dailySummary, setDailySummary] = useState<{
    netPnl: number
    tradeCount: number
    winners: number
    losers: number
    winRate: number
    equityPoints?: number[]
  } | null>(null)
  const [closedTrades, setClosedTrades] = useState<TradeResponse[]>([])
  const [tradeDetail, setTradeDetail] = useState<TradeResponse | null>(null)
  const [templates, setTemplates] = useState<NotebookTemplate[]>([])
  const [attachments, setAttachments] = useState<NotebookAttachment[]>([])
  const [templateSelection, setTemplateSelection] = useState('')
  const [lossRecapOpen, setLossRecapOpen] = useState(false)
  const [lossRecapForm, setLossRecapForm] = useState(defaultLossRecap)

  useEffect(() => {
    console.log('[NotebookPage] render', new Date().toISOString(), {
      search: location.search,
      selectedNoteId: selectedNote?.id,
      selectedFolderId
    })
  })

  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

  const handleAuthFailure = useCallback((message?: string) => {
    setError(message || 'Please login again to access your notebook.')
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate])

  const loadFoldersAndTags = useCallback(async () => {
    try {
      const [folderData, tagData] = await Promise.all([
        listNotebookFolders(),
        listNotebookTags()
      ])
      setFolders(folderData)
      setTags(tagData)
      if (!selectedFolderId && folderData.length > 0) {
        setSelectedFolderId(folderData[0].id)
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Failed to load notebook folders.')
    }
  }, [handleAuthFailure, selectedFolderId])

  const urlNoteId = useMemo(() => new URLSearchParams(location.search).get('noteId'), [location.search])

  const loadNotes = useCallback(async () => {
    if (!selectedFolderId) return
    setLoading(true)
    try {
      console.log('[NotebookPage] loadNotes START', { selectedFolderId, searchQuery, tagIds: filterTags.map(t => t.id), urlNoteId })
      const data = await listNotebookNotes({
        folderId: selectedFolderId,
        q: searchQuery,
        tagIds: filterTags.map((tag) => tag.id)
      })
      console.log('[NotebookPage] loadNotes DONE', { count: data.length })
      setNotes(data)
      // If a noteId is present in the URL, do not auto-select here; let refreshSelectedNote handle it.
      if (urlNoteId) return
      setSelectedNote((prev) => {
        if (!data.length) return null
        if (prev && data.some((note) => note.id === prev.id)) {
          return prev
        }
        return data[0]
      })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Failed to load notes.')
    } finally {
      setLoading(false)
    }
  }, [filterTags, handleAuthFailure, searchQuery, selectedFolderId, urlNoteId])

  const refreshSelectedNote = useCallback(async (noteId: string) => {
    try {
      console.log('[NotebookPage] refreshSelectedNote START', { noteId })
      const data = await getNotebookNote(noteId)
      console.log('[NotebookPage] refreshSelectedNote DONE', { noteId: data.id, folderId: data.folderId })
      setSelectedNote(data)
      if (data.folderId && selectedFolderId !== data.folderId) {
        console.log('[NotebookPage] Switching selectedFolderId to note.folderId', { from: selectedFolderId, to: data.folderId })
        setSelectedFolderId(data.folderId)
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        console.error('[NotebookPage] refreshSelectedNote ERROR', err)
      }
    }
  }, [handleAuthFailure, selectedFolderId])

  useEffect(() => {
    loadFoldersAndTags()
  }, [loadFoldersAndTags])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const noteId = params.get('noteId')
    console.log('[NotebookPage] URL changed', { search: location.search, noteId })
    if (noteId) {
      console.log('[NotebookPage] Calling refreshSelectedNote from URL effect', { noteId })
      refreshSelectedNote(noteId)
    }
  }, [location.search, refreshSelectedNote])

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await listNotebookTemplates(selectedNote?.type)
        setTemplates(data)
        setTemplateSelection('')
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleAuthFailure(err.message)
        }
      }
    }
    if (selectedNote) {
      loadTemplates()
    }
  }, [handleAuthFailure, selectedNote])

  useEffect(() => {
    const loadStats = async () => {
      if (!selectedNote || selectedNote.type !== 'DAILY_LOG' || !selectedNote.dateKey) {
        setDailySummary(null)
        setClosedTrades([])
        return
      }
      try {
        const [summary, trades] = await Promise.all([
          fetchDailySummary(selectedNote.dateKey, timezone),
          listClosedTrades(selectedNote.dateKey, timezone)
        ])
        setDailySummary(summary)
        setClosedTrades(trades)
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleAuthFailure(err.message)
          return
        }
        setDailySummary(null)
      }
    }
    loadStats()
  }, [handleAuthFailure, selectedNote, timezone])

  useEffect(() => {
    const loadTrade = async () => {
      if (!selectedNote?.relatedTradeId) {
        setTradeDetail(null)
        return
      }
      try {
        const trade = await getTradeById(selectedNote.relatedTradeId)
        setTradeDetail(trade)
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleAuthFailure(err.message)
        }
      }
    }
    loadTrade()
  }, [handleAuthFailure, selectedNote?.relatedTradeId])

  useEffect(() => {
    const loadAttachments = async () => {
      if (!selectedNote) {
        setAttachments([])
        return
      }
      try {
        const data = await listNotebookAttachments(selectedNote.id)
        setAttachments(data)
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleAuthFailure(err.message)
        }
      }
    }
    loadAttachments()
  }, [handleAuthFailure, selectedNote])

  useEffect(() => {
    if (!selectedNote) {
      setNoteTags([])
      return
    }
    const mapped = tags.filter((tag) => selectedNote.tagIds?.includes(tag.id))
    setNoteTags(mapped)
  }, [selectedNote, tags])

  const folderTree = useMemo(() => {
    const byParent = new Map<string | null, NotebookFolder[]>()
    folders.forEach((folder) => {
      const key = folder.parentId ?? null
      if (!byParent.has(key)) {
        byParent.set(key, [])
      }
      byParent.get(key)?.push(folder)
    })
    const build = (parentId: string | null, depth = 0): { folder: NotebookFolder; depth: number }[] => {
      const nodes = byParent.get(parentId) || []
      return nodes.flatMap((node) => [{ folder: node, depth }, ...build(node.id, depth + 1)])
    }
    return build(null)
  }, [folders])

  const handleCreateNote = async (type: NotebookNoteType) => {
    try {
      const targetFolder = folders.find((folder) => folder.id === selectedFolderId)
      const folderId = targetFolder && !targetFolder.systemKey ? targetFolder.id : undefined
      const note = await createNotebookNote({
        type,
        title: type === 'DAILY_LOG' ? `Daily log ${formatDate(new Date().toISOString())}` : 'Untitled note',
        dateKey: type === 'DAILY_LOG' ? new Date().toISOString().slice(0, 10) : undefined,
        folderId
      })
      setSelectedNote(note)
      loadNotes()
      navigate(`/notebook?noteId=${note.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to create note.')
      }
    }
  }

  const handleSaveNote = async () => {
    if (!selectedNote) return
    if (!selectedNote.dateKey || !selectedNote.dateKey.trim()) {
      setError('Date is required.')
      return
    }
    try {
      const updated = await updateNotebookNote(selectedNote.id, {
        title: selectedNote.title,
        body: selectedNote.body,
        dateKey: selectedNote.dateKey,
        folderId: selectedNote.folderId,
        type: selectedNote.type,
        relatedTradeId: selectedNote.relatedTradeId
      })
      setSelectedNote(updated)
      loadNotes()
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to save note.')
      }
    }
  }

  const handleDeleteNote = async () => {
    if (!selectedNote) return
    try {
      await deleteNotebookNote(selectedNote.id)
      setSelectedNote(null)
      loadNotes()
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to delete note.')
      }
    }
  }

  const handleRestoreNote = async () => {
    if (!selectedNote) return
    try {
      const restored = await restoreNotebookNote(selectedNote.id)
      setSelectedNote(restored)
      loadNotes()
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to restore note.')
      }
    }
  }

  const handleApplyTemplate = () => {
    if (!selectedNote || !templateSelection) return
    const template = templates.find((item) => item.id === templateSelection)
    if (!template) return
    setSelectedNote({ ...selectedNote, body: template.content ?? '' })
  }

  const handleSaveTemplate = async () => {
    if (!selectedNote) return
    const name = window.prompt('Template name?')
    if (!name) return
    try {
      await createNotebookTemplate({
        name,
        appliesToType: selectedNote.type,
        content: selectedNote.body ?? ''
      })
      const data = await listNotebookTemplates(selectedNote.type)
      setTemplates(data)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      }
    }
  }

  const appendSnippet = (snippet: string) => {
    if (!selectedNote) return
    const current = selectedNote.body ?? ''
    const next = current ? `${current}\n${snippet}` : snippet
    setSelectedNote({ ...selectedNote, body: next })
  }

  const handleUpdateTags = async (value: NotebookTag[]) => {
    if (!selectedNote) return
    setNoteTags(value)
    try {
      await replaceNotebookNoteTags(selectedNote.id, value.map((tag) => tag.id))
      await refreshSelectedNote(selectedNote.id)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      }
    }
  }

  const handleAddTag = async () => {
    const name = window.prompt('New tag name')
    if (!name) return
    try {
      const newTag = await createNotebookTag({ name })
      setTags((prev) => [...prev, newTag])
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to create tag.')
    }
  }

  const handleUploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNote || !event.target.files?.length) return
    const file = event.target.files[0]
    try {
      await uploadNotebookAttachment(selectedNote.id, file)
      const data = await listNotebookAttachments(selectedNote.id)
      setAttachments(data)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to upload attachment.')
    }
  }

  const handleDeleteAttachment = async (id: string) => {
    try {
      await deleteNotebookAttachment(id)
      setAttachments((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to delete attachment.')
    }
  }

  const handleLossRecap = async () => {
    try {
      const losses = await listLosses(lossRecapForm.from, lossRecapForm.to, timezone, lossRecapForm.minLoss)
      const note = await createNotebookNote({
        type: 'SESSION_RECAP',
        title: `Loss recap ${lossRecapForm.from} → ${lossRecapForm.to}`,
        body: buildLossRecapBody(losses)
      })
      setSelectedNote(note)
      loadNotes()
      setLossRecapOpen(false)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to create loss recap note.')
    }
  }

  const handleAddFolder = async () => {
    const name = window.prompt('Folder name')
    if (!name) return
    try {
      const folder = await createNotebookFolder({ name })
      setFolders((prev) => [...prev, folder])
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to create folder.')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteNotebookFolder(folderId)
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to delete folder.')
    }
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h5" sx={{ flex: 1 }}>Notebook</Typography>
          <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={() => handleCreateNote('DAILY_LOG')}>
            New daily log
          </Button>
          <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={() => handleCreateNote('PLAN')}>
            New plan
          </Button>
          <Button variant="outlined" onClick={() => setLossRecapOpen(true)}>
            Create loss recap
          </Button>
        </Stack>
      </Paper>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ flex: 1, minWidth: 260, p: 2 }}>
          <Stack spacing={2}>
            <TextField
              size="small"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddFolder}>
              Add folder
            </Button>
            <Divider />
            <Typography variant="subtitle2">Folders</Typography>
            <List dense>
              {folderTree.map(({ folder, depth }) => (
                <ListItemButton
                  key={folder.id}
                  selected={selectedFolderId === folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  sx={{ pl: 2 + depth * 2 }}
                >
                  <ListItemText primary={folder.name} secondary={folder.systemKey ? undefined : null} />
                  {!folder.systemKey && (
                    <Tooltip title="Delete folder">
                      <IconButton size="small" onClick={(event) => {
                        event.stopPropagation()
                        handleDeleteFolder(folder.id)
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemButton>
              ))}
            </List>
            <Divider />
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Tags</Typography>
              <Button size="small" onClick={handleAddTag}>Add tag</Button>
            </Stack>
            <Autocomplete
              multiple
              options={tags}
              value={filterTags}
              onChange={(_, value) => setFilterTags(value)}
              getOptionLabel={(option) => option.name}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip label={option.name} {...getTagProps({ index })} key={option.id} />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} placeholder="Filter by tag" size="small" />
              )}
            />
          </Stack>
        </Paper>

        <Paper sx={{ flex: 1.2, minWidth: 300, p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => handleCreateNote('NOTE')}>New note</Button>
              <Button variant="outlined" onClick={() => handleCreateNote('GOAL')}>New goal</Button>
            </Stack>
            <Divider />
            {loading && <CircularProgress />}
            {!loading && notes.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No notes found.
              </Typography>
            )}
            <List>
              {notes.map((note) => (
                <ListItemButton
                  key={note.id}
                  selected={selectedNote?.id === note.id}
                  onClick={() => setSelectedNote(note)}
                >
                  <ListItemText
                    primary={note.title || 'Untitled note'}
                    secondary={note.dateKey ? note.dateKey : note.updatedAt ? formatDate(note.updatedAt) : ''}
                  />
                  {note.type === 'DAILY_LOG' && (
                    <Chip label="Daily" size="small" color="primary" variant="outlined" />
                  )}
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </Paper>

        <Paper sx={{ flex: 2, minWidth: 320, p: 2 }}>
          {!selectedNote && (
            <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
              <Typography variant="h6">Select a note</Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => handleCreateNote('DAILY_LOG')}>Create daily log</Button>
                <Button variant="outlined" onClick={() => handleCreateNote('PLAN')}>Create plan</Button>
              </Stack>
            </Stack>
          )}
          {selectedNote && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                  label="Title"
                  value={selectedNote.title ?? ''}
                  onChange={(event) => setSelectedNote({ ...selectedNote, title: event.target.value })}
                  fullWidth
                />
                <Stack spacing={1} alignItems="flex-end">
                  <Button variant="contained" onClick={handleSaveNote}>Save</Button>
                  {selectedNote.isDeleted ? (
                    <Button variant="outlined" startIcon={<RestoreIcon />} onClick={handleRestoreNote}>Restore</Button>
                  ) : (
                    <Button color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={handleDeleteNote}>
                      Delete
                    </Button>
                  )}
                </Stack>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Type"
                  value={selectedNote.type}
                  onChange={(event) => setSelectedNote({ ...selectedNote, type: event.target.value as NotebookNoteType })}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="DAILY_LOG">Daily Log</MenuItem>
                  <MenuItem value="TRADE_NOTE">Trade Note</MenuItem>
                  <MenuItem value="PLAN">Plan</MenuItem>
                  <MenuItem value="GOAL">Goal</MenuItem>
                  <MenuItem value="SESSION_RECAP">Session Recap</MenuItem>
                  <MenuItem value="NOTE">Note</MenuItem>
                </TextField>
                <TextField
                  required
                  label="Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={selectedNote.dateKey ?? ''}
                  onChange={(event) => setSelectedNote({ ...selectedNote, dateKey: event.target.value })}
                  error={!selectedNote.dateKey || !selectedNote.dateKey.trim()}
                  helperText={!selectedNote.dateKey || !selectedNote.dateKey.trim() ? 'Date is required' : ' '}
                  sx={{ minWidth: 200 }}
                />
                <Autocomplete
                  multiple
                  options={tags}
                  value={noteTags}
                  onChange={(_, value) => handleUpdateTags(value)}
                  getOptionLabel={(option) => option.name}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip label={option.name} {...getTagProps({ index })} key={option.id} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Tags" placeholder="Tags" />
                  )}
                  sx={{ flex: 1 }}
                />
              </Stack>

              {selectedNote.type === 'DAILY_LOG' && dailySummary && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <Stack>
                      <Typography variant="subtitle2">Net P&L</Typography>
                      <Typography variant="h6">{formatCurrency(dailySummary.netPnl, baseCurrency)}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <Stack>
                        <Typography variant="caption">Trades</Typography>
                        <Typography>{dailySummary.tradeCount}</Typography>
                      </Stack>
                      <Stack>
                        <Typography variant="caption">Winners</Typography>
                        <Typography>{dailySummary.winners}</Typography>
                      </Stack>
                      <Stack>
                        <Typography variant="caption">Losers</Typography>
                        <Typography>{dailySummary.losers}</Typography>
                      </Stack>
                      <Stack>
                        <Typography variant="caption">Win rate</Typography>
                        <Typography>{Math.round(dailySummary.winRate * 100)}%</Typography>
                      </Stack>
                    </Stack>
                    {renderSparkline(dailySummary.equityPoints)}
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Trades closed today</Typography>
                  {closedTrades.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No closed trades for this date.</Typography>
                  )}
                  {closedTrades.map((trade) => (
                    <Stack key={trade.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Chip label={trade.symbol} size="small" />
                      <Typography variant="body2">{trade.direction}</Typography>
                      <Typography variant="body2">{formatDateTime(trade.closedAt)}</Typography>
                      <Typography variant="body2">{formatCurrency(trade.pnlNet ?? 0, baseCurrency)}</Typography>
                    </Stack>
                  ))}
                </Paper>
              )}

              {selectedNote.type === 'TRADE_NOTE' && tradeDetail && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Trade summary</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip label={tradeDetail.symbol} />
                      <Typography variant="body2">{tradeDetail.direction}</Typography>
                      <Typography variant="body2">Opened {formatDateTime(tradeDetail.openedAt)}</Typography>
                      {tradeDetail.closedAt && (
                        <Typography variant="body2">Closed {formatDateTime(tradeDetail.closedAt)}</Typography>
                      )}
                      <Typography variant="body2">{formatCurrency(tradeDetail.pnlNet ?? 0, baseCurrency)}</Typography>
                      {tradeDetail.strategyTag && (
                        <Chip label={tradeDetail.strategyTag} size="small" variant="outlined" />
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              )}

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    select
                    size="small"
                    label="Apply template"
                    value={templateSelection}
                    onChange={(event) => setTemplateSelection(event.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                    ))}
                  </TextField>
                  <Button variant="outlined" onClick={handleApplyTemplate}>Apply</Button>
                  <Button variant="text" onClick={handleSaveTemplate}>Save as template</Button>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button size="small" variant="outlined" onClick={() => appendSnippet('# Heading')}>
                    Heading
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => appendSnippet('**Bold text**')}>
                    Bold
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => appendSnippet('*Italic text*')}>
                    Italic
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => appendSnippet('- Bullet item')}>
                    Bullet
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => appendSnippet('- [ ] Checklist item')}>
                    Checklist
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => appendSnippet('`inline code`')}>
                    Code
                  </Button>
                </Stack>
                <TextField
                  label="Notes"
                  value={selectedNote.body ?? ''}
                  onChange={(event) => setSelectedNote({ ...selectedNote, body: event.target.value })}
                  multiline
                  minRows={12}
                />
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2">Attachments</Typography>
                <Button component="label" variant="outlined">
                  Upload attachment
                  <input hidden type="file" onChange={handleUploadAttachment} />
                </Button>
                {attachments.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No attachments yet.</Typography>
                )}
                {attachments.map((item) => {
                  const downloadUrl = item.downloadUrl ? `${apiBase}${item.downloadUrl}` : '#'
                  return (
                  <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                    <Button href={downloadUrl} target="_blank" rel="noreferrer">
                      {item.fileName}
                    </Button>
                    <IconButton size="small" onClick={() => handleDeleteAttachment(item.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  )
                })}
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>

      <Dialog open={lossRecapOpen} onClose={() => setLossRecapOpen(false)}>
        <DialogTitle>Create loss recap</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="From"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={lossRecapForm.from}
              onChange={(event) => setLossRecapForm({ ...lossRecapForm, from: event.target.value })}
            />
            <TextField
              label="To"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={lossRecapForm.to}
              onChange={(event) => setLossRecapForm({ ...lossRecapForm, to: event.target.value })}
            />
            <TextField
              label="Min loss"
              type="number"
              value={lossRecapForm.minLoss}
              onChange={(event) => setLossRecapForm({ ...lossRecapForm, minLoss: Number(event.target.value) })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLossRecapOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLossRecap}>Create</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
