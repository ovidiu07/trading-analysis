import { ChangeEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RestoreIcon from '@mui/icons-material/Restore'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import StarIcon from '@mui/icons-material/Star'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditIcon from '@mui/icons-material/Edit'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import ViewListIcon from '@mui/icons-material/ViewList'
import CloseIcon from '@mui/icons-material/Close'
import { useLocation, useNavigate, unstable_useBlocker as useBlocker } from 'react-router-dom'
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
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import RichTextEditor from '../components/ui/RichTextEditor'
const buildNoteFingerprint = (note: NotebookNote | null) => {
  if (!note) return ''
  return JSON.stringify({
    title: note.title ?? '',
    body: note.body ?? '',
    bodyJson: note.bodyJson ?? '',
    dateKey: note.dateKey ?? '',
    folderId: note.folderId ?? '',
    type: note.type ?? '',
    relatedTradeId: note.relatedTradeId ?? '',
    isPinned: note.isPinned ?? false
  })
}

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

const buildLossRecapBody = (trades: TradeResponse[], timezone?: string) => {
  if (!trades.length) {
    return 'No losses matched the selected criteria.'
  }
  const rows = trades
    .map((trade) => {
      const pnl = trade.pnlNet ?? 0
      return `| ${trade.symbol} | ${trade.direction} | ${formatDateTime(trade.closedAt, timezone)} | ${pnl.toFixed(2)} | ${trade.setup ?? ''} |`
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

const looksLikeHtml = (value?: string | null) => {
  if (!value) return false
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const applyInlineMarkdown = (value: string) => value
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')

const convertMarkdownToHtml = (markdown: string) => {
  const lines = markdown.split(/\r?\n/)
  let html = ''
  let listMode: 'ul' | 'ol' | 'task' | null = null

  const closeList = () => {
    if (listMode === 'ul') html += '</ul>'
    if (listMode === 'ol') html += '</ol>'
    if (listMode === 'task') html += '</ul>'
    listMode = null
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) {
      closeList()
      return
    }
    if (/^---+$/.test(line)) {
      closeList()
      html += '<hr />'
      return
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      html += `<h${level}>${applyInlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`
      return
    }
    if (line.startsWith('> ')) {
      closeList()
      html += `<blockquote>${applyInlineMarkdown(escapeHtml(line.slice(2)))}</blockquote>`
      return
    }
    const taskMatch = line.match(/^- \[( |x|X)]\s+(.*)$/)
    if (taskMatch) {
      if (listMode !== 'task') {
        closeList()
        html += '<ul data-type="taskList">'
        listMode = 'task'
      }
      const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked="checked"' : ''
      html += `<li data-type="taskItem"><label><input type="checkbox"${checked} /></label><span>${applyInlineMarkdown(escapeHtml(taskMatch[2]))}</span></li>`
      return
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      if (listMode !== 'ul') {
        closeList()
        html += '<ul>'
        listMode = 'ul'
      }
      html += `<li>${applyInlineMarkdown(escapeHtml(bulletMatch[1]))}</li>`
      return
    }
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      if (listMode !== 'ol') {
        closeList()
        html += '<ol>'
        listMode = 'ol'
      }
      html += `<li>${applyInlineMarkdown(escapeHtml(orderedMatch[1]))}</li>`
      return
    }
    closeList()
    html += `<p>${applyInlineMarkdown(escapeHtml(line))}</p>`
  })

  closeList()
  return html
}

const resolveNoteHtml = (note: NotebookNote | null) => {
  if (!note?.body) return ''
  return looksLikeHtml(note.body) ? note.body : convertMarkdownToHtml(note.body)
}

const extractPlainText = (html: string) => {
  if (typeof window === 'undefined') return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.body.textContent ?? ''
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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PINNED' | NotebookNoteType>('ALL')
  const [sortOrder, setSortOrder] = useState<'updated' | 'created' | 'date'>('updated')
  const [viewMode, setViewMode] = useState<'read' | 'edit'>('edit')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showDeleteUndo, setShowDeleteUndo] = useState(false)
  const [lastDeletedNote, setLastDeletedNote] = useState<NotebookNote | null>(null)
  const [infoMessage, setInfoMessage] = useState('')
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
  const [filtersOpen, setFiltersOpen] = useState(() => localStorage.getItem('tv-notebook-filters') !== 'collapsed')
  const [listOpen, setListOpen] = useState(() => localStorage.getItem('tv-notebook-list') !== 'collapsed')
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)
  const [newMenuAnchor, setNewMenuAnchor] = useState<null | HTMLElement>(null)
  const [mobilePanel, setMobilePanel] = useState<'list' | 'editor'>('list')
  const persistedFingerprintRef = useRef<string>('')
  const isSavingRef = useRef(false)

  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const apiBase = import.meta.env.VITE_API_URL || '/api'
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))

  const confirmDiscard = useCallback(() => {
    if (!isDirty) return true
    return window.confirm('You have unsaved changes. Discard them?')
  }, [isDirty])

  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('You have unsaved changes. Discard them and continue?')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

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
        const allNotes = folderData.find((folder) => folder.systemKey === 'ALL_NOTES')
        setSelectedFolderId(allNotes ? allNotes.id : folderData[0].id)
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
  const allNotesFolder = useMemo(() => folders.find((folder) => folder.systemKey === 'ALL_NOTES'), [folders])

  const loadNotes = useCallback(async () => {
    if (!selectedFolderId) return
    setLoading(true)
    try {
      const effectiveType = typeFilter !== 'ALL' && typeFilter !== 'PINNED' ? typeFilter : undefined
      const data = await listNotebookNotes({
        folderId: selectedFolderId,
        q: searchQuery,
        tagIds: filterTags.map((tag) => tag.id),
        type: effectiveType,
        sort: sortOrder
      })
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
  }, [filterTags, handleAuthFailure, searchQuery, selectedFolderId, sortOrder, typeFilter, urlNoteId])

  const refreshSelectedNote = useCallback(async (noteId: string) => {
    try {
      const data = await getNotebookNote(noteId)
      setSelectedNote(data)
      if (data.folderId && selectedFolderId !== data.folderId) {
        setSelectedFolderId(data.folderId)
      }
      if (!data.folderId && allNotesFolder && selectedFolderId !== allNotesFolder.id) {
        setSelectedFolderId(allNotesFolder.id)
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to refresh the selected note.')
      }
    }
  }, [allNotesFolder, handleAuthFailure, selectedFolderId])

  useEffect(() => {
    loadFoldersAndTags()
  }, [loadFoldersAndTags])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const noteId = params.get('noteId')
    if (noteId) {
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
        ] as const)
        setDailySummary(summary)
        setClosedTrades(trades as TradeResponse[])
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

  useEffect(() => {
    localStorage.setItem('tv-notebook-filters', filtersOpen ? 'open' : 'collapsed')
  }, [filtersOpen])

  useEffect(() => {
    localStorage.setItem('tv-notebook-list', listOpen ? 'open' : 'collapsed')
  }, [listOpen])

  useEffect(() => {
    persistedFingerprintRef.current = buildNoteFingerprint(selectedNote)
    setIsDirty(false)
    setSaveState('idle')
    setLastSavedAt(selectedNote?.updatedAt ?? null)
    if (isMobile) {
      setMobilePanel(selectedNote ? 'editor' : 'list')
    }
  }, [isMobile, selectedNote?.id, selectedNote?.updatedAt])


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

  const visibleNotes = useMemo(() => {
    if (typeFilter === 'PINNED') {
      return notes.filter((note) => note.isPinned)
    }
    return notes
  }, [notes, typeFilter])

  const editorValue = useMemo(() => resolveNoteHtml(selectedNote), [selectedNote])

  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders])

  const sortNotes = useCallback((items: NotebookNote[]) => {
    const getTime = (value?: string | null) => (value ? new Date(value).getTime() : 0)
    return [...items].sort((a, b) => {
      const pinDiff = Number(b.isPinned) - Number(a.isPinned)
      if (pinDiff !== 0) return pinDiff
      switch (sortOrder) {
        case 'created':
          return getTime(b.createdAt) - getTime(a.createdAt)
        case 'date':
          return getTime(b.dateKey) - getTime(a.dateKey) || getTime(b.updatedAt) - getTime(a.updatedAt)
        default:
          return getTime(b.updatedAt) - getTime(a.updatedAt)
      }
    })
  }, [sortOrder])

  const upsertNote = useCallback((note: NotebookNote) => {
    setNotes((prev) => {
      const existing = prev.findIndex((item) => item.id === note.id)
      const next = existing >= 0 ? prev.map((item) => (item.id === note.id ? note : item)) : [note, ...prev]
      return sortNotes(next)
    })
  }, [sortNotes])

  const noteMatchesFilters = useCallback((note: NotebookNote) => {
    if (selectedFolderId && note.folderId && selectedFolderId !== note.folderId) {
      const selectedFolder = folders.find((folder) => folder.id === selectedFolderId)
      if (!selectedFolder?.systemKey) {
        return false
      }
    }
    if (typeFilter !== 'ALL' && typeFilter !== 'PINNED' && note.type !== typeFilter) {
      return false
    }
    if (typeFilter === 'PINNED' && !note.isPinned) {
      return false
    }
    if (filterTags.length > 0 && !filterTags.every((tag) => note.tagIds?.includes(tag.id))) {
      return false
    }
    if (searchQuery.trim()) {
      const haystack = `${note.title ?? ''} ${note.body ?? ''}`.toLowerCase()
      if (!haystack.includes(searchQuery.toLowerCase())) {
        return false
      }
    }
    return true
  }, [filterTags, folders, searchQuery, selectedFolderId, typeFilter])

  useEffect(() => {
    if (!urlNoteId || !selectedNote) return
    if (noteMatchesFilters(selectedNote)) return
    setInfoMessage('Note opened outside your current filters. Showing it in All notes.')
    setSelectedFolderId(allNotesFolder?.id ?? selectedFolderId)
    setTypeFilter('ALL')
    setFilterTags([])
    setSearchQuery('')
  }, [allNotesFolder, noteMatchesFilters, selectedFolderId, selectedNote, urlNoteId])

  const updateDraftNote = useCallback((next: NotebookNote) => {
    setSelectedNote(next)
    setIsDirty(buildNoteFingerprint(next) !== persistedFingerprintRef.current)
    setSaveState('idle')
  }, [])

  const handleCreateNote = async (type: NotebookNoteType) => {
    if (!confirmDiscard()) return
    try {
      const targetFolder = folders.find((folder) => folder.id === selectedFolderId)
      const folderId = targetFolder && !targetFolder.systemKey ? targetFolder.id : undefined
      const today = new Date().toISOString().slice(0, 10)
      const note = await createNotebookNote({
        type,
        title: type === 'DAILY_LOG' ? `Daily log ${formatDate(new Date().toISOString())}` : 'Untitled note',
        dateKey: type === 'DAILY_LOG' ? today : today,
        folderId,
        isPinned: false
      })
      setSelectedNote(note)
      setSaveState('saved')
      setLastSavedAt(note.updatedAt ?? null)
      setViewMode('edit')
      upsertNote(note)
      if (!noteMatchesFilters(note)) {
        setInfoMessage('Note created outside your current filters. Showing it in All notes.')
        setSelectedFolderId(allNotesFolder?.id ?? selectedFolderId)
        setTypeFilter('ALL')
        setFilterTags([])
        setSearchQuery('')
      }
      navigate(`/notebook?noteId=${note.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to create note.')
      }
    }
  }

  const handleSaveNote = useCallback(async () => {
    if (!selectedNote) return
    if (isSavingRef.current) return
    if (selectedNote.type === 'DAILY_LOG' && (!selectedNote.dateKey || !selectedNote.dateKey.trim())) {
      setError('Date is required for daily logs.')
      return
    }
    try {
      isSavingRef.current = true
      setSaveState('saving')
      setError('')
      const dateKey = selectedNote.dateKey && selectedNote.dateKey.trim() ? selectedNote.dateKey : null
      const updated = await updateNotebookNote(selectedNote.id, {
        title: selectedNote.title,
        body: selectedNote.body,
        dateKey,
        folderId: selectedNote.folderId,
        type: selectedNote.type,
        relatedTradeId: selectedNote.relatedTradeId,
        isPinned: selectedNote.isPinned
      })
      persistedFingerprintRef.current = buildNoteFingerprint(updated)
      setSelectedNote(updated)
      setIsDirty(false)
      setSaveState('saved')
      setLastSavedAt(updated.updatedAt ?? null)
      upsertNote(updated)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to save note.')
        setSaveState('error')
      }
    } finally {
      isSavingRef.current = false
    }
  }, [handleAuthFailure, selectedNote, upsertNote])

  const handleDeleteNote = async () => {
    if (!selectedNote) return
    if (!window.confirm('Move this note to Recently deleted?')) {
      return
    }
    try {
      await deleteNotebookNote(selectedNote.id)
      setLastDeletedNote(selectedNote)
      setSelectedNote(null)
      setNotes((prev) => prev.filter((note) => note.id !== selectedNote.id))
      setShowDeleteUndo(true)
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
      upsertNote(restored)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to restore note.')
      }
    }
  }

  const handleUndoDelete = async () => {
    if (!lastDeletedNote) return
    try {
      const restored = await restoreNotebookNote(lastDeletedNote.id)
      setSelectedNote(restored)
      upsertNote(restored)
      setShowDeleteUndo(false)
      setLastDeletedNote(null)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
        return
      }
      setError('Unable to restore note.')
    }
  }

  const handleApplyTemplate = () => {
    if (!selectedNote || !templateSelection) return
    const template = templates.find((item) => item.id === templateSelection)
    if (!template) return
    updateDraftNote({ ...selectedNote, body: template.content ?? '', bodyJson: null })
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

  const handleInsertDailyLogTemplate = () => {
    if (!selectedNote) return
    const html = [
      '<h2>Session bias</h2>',
      '<p></p>',
      '<h2>Key levels</h2>',
      '<ul><li></li></ul>',
      '<h2>News &amp; catalysts</h2>',
      '<ul><li></li></ul>',
      '<h2>Rules to execute</h2>',
      '<ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox" /></label><div><p></p></div></li></ul>',
      '<h2>Post-session review</h2>',
      '<p></p>'
    ].join('')
    updateDraftNote({ ...selectedNote, body: html, bodyJson: null })
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
    if (!confirmDiscard()) return
    try {
      const losses = await listLosses(lossRecapForm.from, lossRecapForm.to, timezone, lossRecapForm.minLoss)
      const note = await createNotebookNote({
        type: 'SESSION_RECAP',
        title: `Loss recap ${lossRecapForm.from} → ${lossRecapForm.to}`,
        body: buildLossRecapBody(losses as TradeResponse[], timezone)
      })
      setSelectedNote(note)
      setSaveState('saved')
      setLastSavedAt(note.updatedAt ?? null)
      upsertNote(note)
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

  const openNewMenu = Boolean(newMenuAnchor)
  const handleOpenNewMenu = (event: MouseEvent<HTMLElement>) => {
    setNewMenuAnchor(event.currentTarget)
  }
  const handleCloseNewMenu = () => {
    setNewMenuAnchor(null)
  }
  const handleNewMenuSelect = (action: 'DAILY_LOG' | 'PLAN' | 'SESSION_RECAP' | 'NOTE' | 'GOAL') => {
    handleCloseNewMenu()
    if (action === 'SESSION_RECAP') {
      setLossRecapOpen(true)
      return
    }
    void handleCreateNote(action)
  }

  const handleSelectFolder = (folderId: string) => {
    if (selectedFolderId === folderId) return
    if (!confirmDiscard()) return
    setSelectedFolderId(folderId)
  }

  const handleSelectNote = (note: NotebookNote) => {
    if (selectedNote?.id === note.id) return
    if (!confirmDiscard()) return
    setSelectedNote(note)
    navigate(`/notebook?noteId=${note.id}`)
    if (isMobile) {
      setMobilePanel('editor')
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Notebook"
        subtitle="Capture session notes, daily logs, and trade reflections."
        actions={(
          isMobile ? (
            <>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNewMenu}>
                New
              </Button>
              <Menu anchorEl={newMenuAnchor} open={openNewMenu} onClose={handleCloseNewMenu}>
                <MenuItem onClick={() => handleNewMenuSelect('DAILY_LOG')}>New daily log</MenuItem>
                <MenuItem onClick={() => handleNewMenuSelect('PLAN')}>New plan</MenuItem>
                <MenuItem onClick={() => handleNewMenuSelect('SESSION_RECAP')}>Create loss recap</MenuItem>
                <MenuItem onClick={() => handleNewMenuSelect('NOTE')}>New note</MenuItem>
                <MenuItem onClick={() => handleNewMenuSelect('GOAL')}>New goal</MenuItem>
              </Menu>
            </>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" startIcon={<NoteAddIcon />} onClick={() => handleCreateNote('DAILY_LOG')}>
                New daily log
              </Button>
              <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={() => handleCreateNote('PLAN')}>
                New plan
              </Button>
              <Button variant="outlined" onClick={() => setLossRecapOpen(true)}>
                Create loss recap
              </Button>
            </Stack>
          )
        )}
      />

      {error && <ErrorBanner message={error} />}
      {infoMessage && (
        <Alert severity="info" onClose={() => setInfoMessage('')}>
          {infoMessage}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: '280px 1fr' },
          width: '100%',
          minWidth: 0
        }}
      >
        {isDesktop && (
          <Paper sx={{ p: 2, minWidth: 0 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={600}>Filters</Typography>
                <IconButton size="small" onClick={() => setFiltersOpen((prev) => !prev)} aria-label="Toggle filters panel">
                  <FilterAltIcon fontSize="small" />
                </IconButton>
              </Stack>
              {filtersOpen && (
                <Stack spacing={2}>
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
                        onClick={() => handleSelectFolder(folder.id)}
                        sx={{ pl: 2 + depth * 2 }}
                      >
                        <ListItemText primary={folder.name} secondary={folder.systemKey ? 'System view' : null} />
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
              )}
            </Stack>
          </Paper>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 340px) 1fr' },
            width: '100%',
            minWidth: 0
          }}
        >
          <Paper sx={{ p: 2, display: { xs: mobilePanel === 'list' ? 'block' : 'none', md: 'block' }, minWidth: 0 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={600}>Notes</Typography>
                <Stack direction="row" spacing={1}>
                  {!isDesktop && (
                    <IconButton size="small" onClick={() => setFiltersDrawerOpen(true)} aria-label="Open filters">
                      <FilterAltIcon fontSize="small" />
                    </IconButton>
                  )}
                  {isMdUp && (
                    <IconButton size="small" onClick={() => setListOpen((prev) => !prev)} aria-label="Toggle note list">
                      <ViewListIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
              {(listOpen || !isMdUp) && (
                <>
                  {!isMobile && (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button variant="outlined" onClick={() => handleCreateNote('NOTE')}>New note</Button>
                      <Button variant="outlined" onClick={() => handleCreateNote('GOAL')}>New goal</Button>
                    </Stack>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
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
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                      <TextField
                        select
                        size="small"
                        label="Sort"
                        value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value as 'updated' | 'created' | 'date')}
                        sx={{ minWidth: { sm: 160 } }}
                      >
                        <MenuItem value="updated">Last updated</MenuItem>
                        <MenuItem value="created">Created</MenuItem>
                        <MenuItem value="date">Note date</MenuItem>
                      </TextField>
                      <Typography variant="caption" color="text.secondary">
                        {visibleNotes.length} notes
                      </Typography>
                    </Stack>
                  </Stack>
                  <ToggleButtonGroup
                    size="small"
                    value={typeFilter}
                    exclusive
                    onChange={(_, value) => value && setTypeFilter(value)}
                    sx={{ flexWrap: 'wrap', gap: 1 }}
                  >
                    <ToggleButton value="ALL">All</ToggleButton>
                    <ToggleButton value="DAILY_LOG">Daily logs</ToggleButton>
                    <ToggleButton value="PLAN">Plans</ToggleButton>
                    <ToggleButton value="SESSION_RECAP">Recaps</ToggleButton>
                    <ToggleButton value="PINNED">Pinned</ToggleButton>
                  </ToggleButtonGroup>
                  <Divider />
                  {loading && (
                    <Stack spacing={1}>
                      <Skeleton variant="rounded" height={56} />
                      <Skeleton variant="rounded" height={56} />
                      <Skeleton variant="rounded" height={56} />
                    </Stack>
                  )}
                  {!loading && visibleNotes.length === 0 && (
                    <EmptyState title="No notes yet" description="Create a note or daily log to get started." />
                  )}
                  <List>
                    {visibleNotes.map((note) => {
                      const folderName = note.folderId ? folderMap.get(note.folderId)?.name : undefined
                      const previewSource = resolveNoteHtml(note)
                      const excerpt = previewSource ? extractPlainText(previewSource).slice(0, 120) : 'Start writing your note...'
                      return (
                        <ListItemButton
                          key={note.id}
                          selected={selectedNote?.id === note.id}
                          onClick={() => handleSelectNote(note)}
                          sx={{ alignItems: 'flex-start' }}
                        >
                          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="subtitle2" fontWeight={600} noWrap>
                                {note.title || 'Untitled note'}
                              </Typography>
                              {note.isPinned && <StarIcon fontSize="small" color="warning" />}
                              <Chip label={note.type.replace('_', ' ')} size="small" variant="outlined" />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {excerpt}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              {folderName && <Chip label={folderName} size="small" />}
                              {note.tagIds?.slice(0, 2).map((tagId) => {
                                const tag = tagMap.get(tagId)
                                return tag ? <Chip key={tagId} label={tag.name} size="small" variant="outlined" /> : null
                              })}
                              <Typography variant="caption" color="text.secondary">
                                Updated {note.updatedAt ? formatDateTime(note.updatedAt, timezone) : '—'}
                              </Typography>
                            </Stack>
                          </Stack>
                        </ListItemButton>
                      )
                    })}
                  </List>
                </>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 2, display: { xs: mobilePanel === 'editor' ? 'block' : 'none', md: 'block' }, minWidth: 0 }}>
            {!selectedNote && (
              <EmptyState
                title="Select a note"
                description="Pick a note from the list or create a new one."
                action={(
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="outlined" onClick={() => handleCreateNote('DAILY_LOG')}>Create daily log</Button>
                    <Button variant="outlined" onClick={() => handleCreateNote('PLAN')}>Create plan</Button>
                  </Stack>
                )}
              />
            )}
            {selectedNote && (
              <Stack spacing={2}>
                {isMobile && (
                  <Button size="small" onClick={() => setMobilePanel('list')}>
                    Back to list
                  </Button>
                )}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                  <TextField
                    label="Title"
                    value={selectedNote.title ?? ''}
                    onChange={(event) => updateDraftNote({ ...selectedNote, title: event.target.value })}
                    fullWidth
                  />
                  <Box
                    sx={{
                      position: { xs: 'sticky', md: 'static' },
                      top: { xs: 0, md: 'auto' },
                      zIndex: 1,
                      width: { xs: '100%', md: 'auto' },
                      bgcolor: { xs: 'background.paper', md: 'transparent' },
                      pb: { xs: 1, md: 0 }
                    }}
                  >
                    <Stack spacing={1} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Tooltip title={selectedNote.isPinned ? 'Unpin note' : 'Pin note'}>
                          <IconButton onClick={() => updateDraftNote({ ...selectedNote, isPinned: !selectedNote.isPinned })}>
                            {selectedNote.isPinned ? <StarIcon color="warning" /> : <StarBorderIcon />}
                          </IconButton>
                        </Tooltip>
                        <ToggleButtonGroup
                          size="small"
                          value={viewMode}
                          exclusive
                          onChange={(_, value) => value && setViewMode(value)}
                        >
                          <ToggleButton value="read" aria-label="Read mode">
                            <VisibilityIcon fontSize="small" />
                          </ToggleButton>
                          <ToggleButton value="edit" aria-label="Edit mode">
                            <EditIcon fontSize="small" />
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Button
                          variant="contained"
                          onClick={handleSaveNote}
                          disabled={saveState === 'saving' || !isDirty}
                          fullWidth={isMobile}
                        >
                          {saveState === 'saving' ? 'Saving…' : 'Save'}
                        </Button>
                        {selectedNote.isDeleted ? (
                          <Button
                            variant="outlined"
                            startIcon={<RestoreIcon />}
                            onClick={handleRestoreNote}
                            fullWidth={isMobile}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteIcon />}
                            onClick={handleDeleteNote}
                            fullWidth={isMobile}
                          >
                            Delete
                          </Button>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {saveState === 'saving' && 'Saving…'}
                        {saveState === 'error' && 'Save failed'}
                        {saveState === 'saved' && lastSavedAt && `Saved ${formatDateTime(lastSavedAt, timezone)}`}
                        {saveState === 'idle' && (isDirty ? 'Unsaved changes' : 'All changes saved')}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    select
                    label="Type"
                    value={selectedNote.type}
                    onChange={(event) => updateDraftNote({ ...selectedNote, type: event.target.value as NotebookNoteType })}
                    sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}
                  >
                    <MenuItem value="DAILY_LOG">Daily Log</MenuItem>
                    <MenuItem value="TRADE_NOTE">Trade Note</MenuItem>
                    <MenuItem value="PLAN">Plan</MenuItem>
                    <MenuItem value="GOAL">Goal</MenuItem>
                    <MenuItem value="SESSION_RECAP">Session Recap</MenuItem>
                    <MenuItem value="NOTE">Note</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Folder"
                    value={selectedNote.folderId ?? ''}
                    onChange={(event) => updateDraftNote({ ...selectedNote, folderId: event.target.value || null })}
                    sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}
                  >
                    <MenuItem value="">No folder</MenuItem>
                    {folders.filter((folder) => !folder.systemKey).map((folder) => (
                      <MenuItem key={folder.id} value={folder.id}>{folder.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    required={selectedNote.type === 'DAILY_LOG'}
                    label="Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={selectedNote.dateKey ?? ''}
                    onChange={(event) => updateDraftNote({ ...selectedNote, dateKey: event.target.value })}
                    error={selectedNote.type === 'DAILY_LOG' && (!selectedNote.dateKey || !selectedNote.dateKey.trim())}
                    helperText={selectedNote.type === 'DAILY_LOG' && (!selectedNote.dateKey || !selectedNote.dateKey.trim()) ? 'Date is required' : ' '}
                    sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}
                  />
                  <TextField
                    label="Linked trade ID"
                    value={selectedNote.relatedTradeId ?? ''}
                    onChange={(event) => updateDraftNote({ ...selectedNote, relatedTradeId: event.target.value || null })}
                    placeholder="Optional trade UUID"
                    sx={{ minWidth: { md: 240 }, width: { xs: '100%', md: 'auto' } }}
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
                    sx={{ flex: 1, minWidth: { md: 240 } }}
                  />
                </Stack>

                {selectedNote.type === 'DAILY_LOG' && dailySummary && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                      <Stack>
                        <Typography variant="subtitle2">Net P&L</Typography>
                        <Typography variant="h6">{formatCurrency(dailySummary.netPnl, baseCurrency)}</Typography>
                      </Stack>
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 2,
                          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
                          flex: 1
                        }}
                      >
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
                      </Box>
                      {renderSparkline(dailySummary.equityPoints)}
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>Trades closed today</Typography>
                    {closedTrades.length === 0 && (
                      <Typography variant="body2" color="text.secondary">No closed trades for this date.</Typography>
                    )}
                    {closedTrades.map((trade) => (
                      <Stack key={trade.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
                        <Chip label={trade.symbol} size="small" />
                        <Typography variant="body2">{trade.direction}</Typography>
                        <Typography variant="body2">{formatDateTime(trade.closedAt, timezone)}</Typography>
                        <Typography variant="body2">{formatCurrency(trade.pnlNet ?? 0, baseCurrency)}</Typography>
                      </Stack>
                    ))}
                  </Paper>
                )}

                {selectedNote.type === 'TRADE_NOTE' && tradeDetail && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Trade summary</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                        <Chip label={tradeDetail.symbol} />
                        <Typography variant="body2">{tradeDetail.direction}</Typography>
                        <Typography variant="body2">Opened {formatDateTime(tradeDetail.openedAt, timezone)}</Typography>
                        {tradeDetail.closedAt && (
                          <Typography variant="body2">Closed {formatDateTime(tradeDetail.closedAt, timezone)}</Typography>
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
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap={{ xs: 'nowrap', sm: 'wrap' }}
                    sx={{
                      overflowX: { xs: 'auto', sm: 'visible' },
                      pb: { xs: 1, sm: 0 }
                    }}
                  >
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
                    {selectedNote.type === 'DAILY_LOG' && (
                      <Button variant="text" onClick={handleInsertDailyLogTemplate}>Insert daily log structure</Button>
                    )}
                  </Stack>
                  <RichTextEditor
                    value={editorValue}
                    readOnly={viewMode === 'read'}
                    onChange={(html) => updateDraftNote({ ...selectedNote, body: html, bodyJson: null })}
                  />
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="subtitle2">Attachments</Typography>
                  <Button component="label" variant="outlined" fullWidth={isMobile}>
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
        </Box>
      </Box>

      <Drawer
        anchor="left"
        open={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { lg: 'none' } }}
      >
        <Box sx={{ width: { xs: '100vw', sm: 320 }, p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle1" fontWeight={600}>Filters</Typography>
              <IconButton size="small" onClick={() => setFiltersDrawerOpen(false)} aria-label="Close filters">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
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
                  onClick={() => {
                    handleSelectFolder(folder.id)
                    setFiltersDrawerOpen(false)
                  }}
                  sx={{ pl: 2 + depth * 2 }}
                >
                  <ListItemText primary={folder.name} secondary={folder.systemKey ? 'System view' : null} />
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
        </Box>
      </Drawer>

      <Snackbar
        open={showDeleteUndo}
        autoHideDuration={6000}
        onClose={() => setShowDeleteUndo(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          action={(
            <Button color="inherit" size="small" onClick={handleUndoDelete}>
              Undo
            </Button>
          )}
        >
          Note moved to Recently deleted.
        </Alert>
      </Snackbar>

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
