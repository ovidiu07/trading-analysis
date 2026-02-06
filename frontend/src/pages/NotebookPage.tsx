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
  useMediaQuery
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useLocation, useNavigate } from 'react-router-dom'
import { useBlocker } from "react-router";
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
  if (!note) return ''
  // Prefer structured content if available
  if (note.bodyJson && note.bodyJson.trim()) {
    try {
      const parsed = JSON.parse(note.bodyJson)
      if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
        return parsed.content
      }
      // If bodyJson contains raw HTML string instead of JSON object
      if (typeof parsed === 'string' && parsed.trim()) {
        return looksLikeHtml(parsed) ? parsed : convertMarkdownToHtml(parsed)
      }
    } catch {
      // If not valid JSON, treat bodyJson as potential HTML
      const maybeHtml = note.bodyJson
      if (maybeHtml && maybeHtml.trim()) {
        return looksLikeHtml(maybeHtml) ? maybeHtml : convertMarkdownToHtml(maybeHtml)
      }
    }
  }
  if (note.body && note.body.trim()) {
    return looksLikeHtml(note.body) ? note.body : convertMarkdownToHtml(note.body)
  }
  return ''
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
  const [editorMenuAnchor, setEditorMenuAnchor] = useState<null | HTMLElement>(null)
  const [mobilePanel, setMobilePanel] = useState<'list' | 'editor'>('list')
  const persistedFingerprintRef = useRef<string>('')
  const isSavingRef = useRef(false)
  const outOfFilterNoticeRef = useRef<string | null>(null)

  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const apiBase = import.meta.env.VITE_API_URL || '/api'
  const isMobile = useMediaQuery('(max-width: 767.98px)')
  const isTabletUp = useMediaQuery('(min-width: 768px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

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
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      } else {
        setError('Unable to refresh the selected note.')
      }
    }
  }, [handleAuthFailure])

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
    if (isDesktop && filtersDrawerOpen) {
      setFiltersDrawerOpen(false)
    }
  }, [filtersDrawerOpen, isDesktop])

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
  const outsideFilterMessage = 'Note opened outside your current filters. Adjust filters to see it in the list.'

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
      const previewSource = resolveNoteHtml(note)
      const text = previewSource ? extractPlainText(previewSource) : ''
      const haystack = `${note.title ?? ''} ${text}`.toLowerCase()
      if (!haystack.includes(searchQuery.toLowerCase())) {
        return false
      }
    }
    return true
  }, [filterTags, folders, searchQuery, selectedFolderId, typeFilter])

  useEffect(() => {
    if (!urlNoteId || !selectedNote) return
    if (noteMatchesFilters(selectedNote)) {
      if (infoMessage === outsideFilterMessage) {
        setInfoMessage('')
      }
      if (outOfFilterNoticeRef.current === selectedNote.id) {
        outOfFilterNoticeRef.current = null
      }
      return
    }
    if (outOfFilterNoticeRef.current === selectedNote.id) return
    outOfFilterNoticeRef.current = selectedNote.id
    setInfoMessage(outsideFilterMessage)
  }, [infoMessage, noteMatchesFilters, outsideFilterMessage, selectedNote, urlNoteId])

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
      const html = editorValue
      const payloadBodyJson = selectedNote.bodyJson && selectedNote.bodyJson.trim() ? selectedNote.bodyJson : JSON.stringify({ format: 'html', content: html })
      const payloadBody = selectedNote.body && selectedNote.body.trim() ? selectedNote.body : extractPlainText(html)
      const updated = await updateNotebookNote(selectedNote.id, {
        title: selectedNote.title,
        body: payloadBody,
        bodyJson: payloadBodyJson,
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
    const html = template.content ?? ''
    const plain = extractPlainText(html)
    const json = JSON.stringify({ format: 'html', content: html })
    updateDraftNote({ ...selectedNote, body: plain, bodyJson: json })
  }

  const handleSaveTemplate = async () => {
    if (!selectedNote) return
    const name = window.prompt('Template name?')
    if (!name) return
    try {
      // Save current editor HTML as template content for fidelity
      await createNotebookTemplate({
        name,
        appliesToType: selectedNote.type,
        content: editorValue
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
    const plain = extractPlainText(html)
    const json = JSON.stringify({ format: 'html', content: html })
    updateDraftNote({ ...selectedNote, body: plain, bodyJson: json })
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
      const markdown = buildLossRecapBody(losses as TradeResponse[], timezone)
      const html = convertMarkdownToHtml(markdown)
      const plain = extractPlainText(html)
      const note = await createNotebookNote({
        type: 'SESSION_RECAP',
        title: `Loss recap ${lossRecapForm.from} → ${lossRecapForm.to}`,
        body: plain,
        bodyJson: JSON.stringify({ format: 'html', content: html })
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

  const isFiltersCollapsed = isDesktop && !filtersOpen
  const isListCollapsed = isTabletUp && !listOpen

  const filtersColumn = isDesktop
    ? (filtersOpen ? 'minmax(220px, 300px)' : '72px')
    : '1fr'
  const listColumn = isTabletUp
    ? (listOpen ? 'minmax(280px, 360px)' : '96px')
    : '1fr'
  const panelsTemplate = isDesktop
    ? `${filtersColumn} ${listColumn} minmax(0, 1fr)`
    : isTabletUp
      ? `${listColumn} minmax(0, 1fr)`
      : '1fr'

  const panelSx = {
    minWidth: 0,
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }

  const panelHeaderSx = {
    px: 2,
    py: 1.5,
    borderBottom: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.paper'
  }

  const panelBodySx = {
    p: 2,
    pt: 1.5,
    pb: 'calc(16px + env(safe-area-inset-bottom))',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden'
  }

  const renderFiltersContent = (onAfterSelect?: () => void) => (
    <Stack spacing={2}>
      <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddFolder}>
        Add folder
      </Button>
      <Divider />
      <Typography variant="subtitle2">Folders</Typography>
      <List dense sx={{ minWidth: 0 }}>
        {folderTree.map(({ folder, depth }) => (
          <ListItemButton
            key={folder.id}
            selected={selectedFolderId === folder.id}
            onClick={() => {
              handleSelectFolder(folder.id)
              onAfterSelect?.()
            }}
            sx={{ pl: 2 + depth * 2, pr: 1 }}
          >
            <ListItemText
              primary={folder.name}
              secondary={folder.systemKey ? 'System view' : null}
              primaryTypographyProps={{ noWrap: true }}
            />
            {!folder.systemKey && (
              <Tooltip title="Delete folder">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDeleteFolder(folder.id)
                  }}
                >
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
  )

  return (
    <Stack spacing={3} sx={{ overflowX: 'hidden', height: '100%', minHeight: 0, overflow: 'hidden' }}>
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
          width: '100%',
          minWidth: 0,
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch',
          gridTemplateRows: 'minmax(0, 1fr)',
          gridTemplateColumns: panelsTemplate
        }}
      >
        {isDesktop && (
          <Paper sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Stack direction="row" alignItems="center" justifyContent={isFiltersCollapsed ? 'center' : 'space-between'}>
                {!isFiltersCollapsed && (
                  <Typography variant="subtitle1" fontWeight={600}>Filters</Typography>
                )}
                <Tooltip title={filtersOpen ? 'Collapse filters' : 'Expand filters'}>
                  <IconButton
                    size="small"
                    onClick={() => setFiltersOpen((prev) => !prev)}
                    aria-label={filtersOpen ? 'Collapse filters' : 'Expand filters'}
                    sx={isMobile ? { minWidth: 44, minHeight: 44 } : undefined}
                  >
                    <FilterAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
            {filtersOpen && (
              <Box sx={panelBodySx}>
                {renderFiltersContent()}
              </Box>
            )}
          </Paper>
        )}

        {(!isMobile || mobilePanel === 'list') && (
          <Paper sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                {!isListCollapsed && (
                  <Typography variant="subtitle1" fontWeight={600}>Notes</Typography>
                )}
                <Stack direction="row" spacing={1}>
                  {!isDesktop && (
                    <IconButton
                      size="small"
                      onClick={() => setFiltersDrawerOpen(true)}
                      aria-label="Open filters"
                      sx={isMobile ? { minWidth: 44, minHeight: 44 } : undefined}
                    >
                      <FilterAltIcon fontSize="small" />
                    </IconButton>
                  )}
                  {isTabletUp && (
                    <IconButton
                      size="small"
                      onClick={() => setListOpen((prev) => !prev)}
                      aria-label="Toggle note list"
                    >
                      <ViewListIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
            </Box>
            <Box sx={panelBodySx}>
              {(listOpen || !isTabletUp) ? (
                <Stack spacing={2}>
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
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                      <TextField
                        select
                        size="small"
                        label="Sort"
                        value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value as 'updated' | 'created' | 'date')}
                        sx={{ minWidth: { sm: 160 }, width: { xs: '100%', sm: 'auto' } }}
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
                    aria-label="Filter notes by type"
                    sx={{
                      flexWrap: { xs: 'nowrap', sm: 'wrap' },
                      gap: 1,
                      overflowX: { xs: 'auto', sm: 'visible' },
                      '& .MuiToggleButton-root': { flexShrink: 0 }
                    }}
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
                  <List sx={{ minWidth: 0 }}>
                    {visibleNotes.map((note) => {
                      const folderName = note.folderId ? folderMap.get(note.folderId)?.name : undefined
                      const previewSource = resolveNoteHtml(note)
                      const excerpt = previewSource ? extractPlainText(previewSource).slice(0, 160) : 'Start writing your note...'
                      return (
                        <ListItemButton
                          key={note.id}
                          selected={selectedNote?.id === note.id}
                          onClick={() => handleSelectNote(note)}
                          sx={{ alignItems: 'flex-start' }}
                        >
                          <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography
                                variant="subtitle2"
                                fontWeight={600}
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                              >
                                {note.title || 'Untitled note'}
                              </Typography>
                              {note.isPinned && <StarIcon fontSize="small" color="warning" />}
                              <Chip label={note.type.replace('_', ' ')} size="small" variant="outlined" />
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
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
                </Stack>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                  <Typography variant="caption" color="text.secondary">List collapsed</Typography>
                </Stack>
              )}
            </Box>
          </Paper>
        )}

        {(!isMobile || mobilePanel === 'editor') && (
          <Paper sx={panelSx}>
            <Box sx={panelHeaderSx}>
              {!selectedNote && (
                <Typography variant="subtitle1" fontWeight={600}>Editor</Typography>
              )}
              {selectedNote && (
                <Stack spacing={1.5}>
                  {isMobile && (
                    <>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton
                            size="small"
                            onClick={() => setMobilePanel('list')}
                            aria-label="Back to notes list"
                            sx={{ minWidth: 44, minHeight: 44 }}
                          >
                            <ArrowBackIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setFiltersDrawerOpen(true)}
                            aria-label="Open folders"
                            sx={{ minWidth: 44, minHeight: 44 }}
                          >
                            <FilterAltIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1, mx: 1, textAlign: 'center' }}>
                          {selectedNote.title || 'Untitled note'}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="More actions"
                          onClick={(e) => setEditorMenuAnchor(e.currentTarget)}
                          sx={{ minWidth: 44, minHeight: 44 }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <Menu
                        anchorEl={editorMenuAnchor}
                        open={Boolean(editorMenuAnchor)}
                        onClose={() => setEditorMenuAnchor(null)}
                      >
                        <MenuItem onClick={() => { setEditorMenuAnchor(null); updateDraftNote({ ...selectedNote, isPinned: !selectedNote.isPinned }); }}>
                          {selectedNote.isPinned ? 'Unpin' : 'Pin'}
                        </MenuItem>
                        {selectedNote.isDeleted ? (
                          <MenuItem onClick={() => { setEditorMenuAnchor(null); void handleRestoreNote(); }}>Restore</MenuItem>
                        ) : (
                          <MenuItem onClick={() => { setEditorMenuAnchor(null); void handleDeleteNote(); }}>Delete</MenuItem>
                        )}
                        <MenuItem onClick={() => { setEditorMenuAnchor(null); handleInsertDailyLogTemplate(); }}>Insert daily log structure</MenuItem>
                        <MenuItem onClick={() => { setEditorMenuAnchor(null); void handleSaveTemplate(); }}>Save as template</MenuItem>
                        <MenuItem onClick={() => { setEditorMenuAnchor(null); setFiltersDrawerOpen(true); }}>Open folders</MenuItem>
                      </Menu>
                    </>
                  )}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                    <TextField
                      label="Title"
                      value={selectedNote.title ?? ''}
                      onChange={(event) => updateDraftNote({ ...selectedNote, title: event.target.value })}
                      fullWidth
                    />
                    <Stack spacing={1} alignItems={{ xs: 'stretch', md: 'flex-end' }} sx={{ width: { xs: '100%', md: 'auto' } }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Tooltip title={selectedNote.isPinned ? 'Unpin note' : 'Pin note'}>
                          <IconButton
                            onClick={() => updateDraftNote({ ...selectedNote, isPinned: !selectedNote.isPinned })}
                            sx={isMobile ? { minWidth: 44, minHeight: 44 } : undefined}
                          >
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
                  </Stack>
                </Stack>
              )}
            </Box>
            <Box sx={panelBodySx}>
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
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        lg: 'repeat(3, minmax(0, 1fr))'
                      }
                    }}
                  >
                    <TextField
                      select
                      label="Type"
                      value={selectedNote.type}
                      onChange={(event) => updateDraftNote({ ...selectedNote, type: event.target.value as NotebookNoteType })}
                      fullWidth
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
                      fullWidth
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
                      fullWidth
                    />
                    <TextField
                      label="Linked trade ID"
                      value={selectedNote.relatedTradeId ?? ''}
                      onChange={(event) => updateDraftNote({ ...selectedNote, relatedTradeId: event.target.value || null })}
                      placeholder="Optional trade UUID"
                      fullWidth
                      inputProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' } }}
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
                    />
                  </Box>

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
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                      flexWrap="wrap"
                    >
                      <TextField
                        select
                        size="small"
                        label="Apply template"
                        value={templateSelection}
                        onChange={(event) => setTemplateSelection(event.target.value)}
                        sx={{ minWidth: { sm: 200 }, width: { xs: '100%', sm: 'auto' } }}
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
                      compactToolbar={isMobile}
                      onChange={(html) => {
                        if (!selectedNote) return
                        const plain = extractPlainText(html)
                        const json = JSON.stringify({ format: 'html', content: html })
                        updateDraftNote({ ...selectedNote, body: plain, bodyJson: json })
                      }}
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
                          <Button
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            sx={{
                              textTransform: 'none',
                              maxWidth: '100%',
                              justifyContent: 'flex-start',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
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
            </Box>
          </Paper>
        )}
      </Box>

      {!isDesktop && (
        <Drawer
          anchor={isMobile ? 'bottom' : 'left'}
          open={filtersDrawerOpen}
          onClose={() => setFiltersDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: isMobile ? '100%' : 320,
              height: isMobile ? '75dvh' : '100dvh',
              maxHeight: isMobile ? '90dvh' : '100dvh',
              borderTopLeftRadius: isMobile ? 16 : 0,
              borderTopRightRadius: isMobile ? 16 : 0
            }
          }}
        >
          <Box sx={{ p: 2, height: '100%', overflowY: 'auto', pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={600}>Filters</Typography>
                <IconButton size="small" onClick={() => setFiltersDrawerOpen(false)} aria-label="Close filters">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              {renderFiltersContent(() => setFiltersDrawerOpen(false))}
            </Stack>
          </Box>
        </Drawer>
      )}

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

      <Dialog open={lossRecapOpen} onClose={() => setLossRecapOpen(false)} fullScreen={isMobile} scroll="paper">
        <DialogTitle>Create loss recap</DialogTitle>
        <DialogContent sx={{ maxHeight: '100dvh', overflowY: 'auto' }}>
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
