import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
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
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ViewListIcon from '@mui/icons-material/ViewList'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import PushPinIcon from '@mui/icons-material/PushPin'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useLocation, useNavigate } from 'react-router-dom'
import { useBlocker } from 'react-router'
import { useAuth } from '../auth/AuthContext'
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
  getNotebookNote,
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
import { ApiError } from '../api/client'
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, fetchAssetBlob, resolveAssetUrl } from '../api/assets'
import { TradeResponse, getTradeById, searchTrades } from '../api/trades'
import { formatDate, formatDateTime } from '../utils/format'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { useDemoData } from '../features/demo/DemoDataContext'
import ErrorBanner from '../components/ui/ErrorBanner'
import EmptyState from '../components/ui/EmptyState'
import NotebookLayout from '../components/notebook/NotebookLayout'
import NoteList from '../components/notebook/NoteList'
import NewNoteMenu from '../components/notebook/NewNoteMenu'
import FiltersDrawer from '../components/notebook/FiltersDrawer'
import NoteViewer from '../components/notebook/NoteViewer'
import NoteEditor from '../components/notebook/NoteEditor'
import NoteMetaSidebar from '../components/notebook/NoteMetaSidebar'
import { buildNoteFingerprint, convertMarkdownToHtml, extractPlainText, resolveNoteHtml } from '../components/notebook/noteContent'
import {
  AdvancedNoteFilters,
  NoteContentTab,
  NotePanelMode,
  NoteReview,
  NoteReviewRuleBreak,
  NoteSortOrder,
  NotebookNavigationState,
  NotebookSmartViewKey
} from '../components/notebook/types'
import { UploadQueueItem } from '../components/assets/AssetListRenderer'

const STORAGE_KEYS = {
  nav: 'tv-notebook-nav-v2',
  filters: 'tv-notebook-filters-v2',
  listCollapsed: 'tv-notebook-list-collapsed-v2',
  metaCollapsed: 'tv-notebook-meta-collapsed-v2'
} as const

const defaultFilters: AdvancedNoteFilters = {
  folderId: '',
  type: 'ALL',
  tagIds: [],
  from: '',
  to: '',
  linkedTrade: 'ALL',
  hasAttachments: 'ALL'
}

const defaultReview: NoteReview = {
  setupQuality: null,
  followedPlan: null,
  ruleBreaks: [],
  didWell: '',
  improveNext: '',
  nextRule: ''
}

type LossRecapForm = {
  from: string
  to: string
  minLoss: number
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

const defaultLossRecap: LossRecapForm = {
  from: new Date().toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  minLoss: 50
}

const reviewRuleBreakOptions: NoteReviewRuleBreak[] = [
  'early_exit',
  'oversize',
  'revenge',
  'moved_stop_loss',
  'chased_entry',
  'no_entry_criteria',
  'added_without_setup',
  'ignored_news',
  'no_risk_plan'
]

const smartViewToSystemKey: Record<NotebookSmartViewKey, string> = {
  ALL_NOTES: 'ALL_NOTES',
  DAILY_LOGS: 'DAILY_JOURNAL',
  PLANS: 'PLANS_GOALS',
  RECAPS: 'SESSIONS_RECAP',
  PINNED: 'ALL_NOTES',
  RECENTLY_DELETED: 'RECENTLY_DELETED'
}

const buildLossRecapBody = (trades: TradeResponse[], t: TranslateFn, timezone?: string) => {
  if (!trades.length) {
    return t('notebook.lossRecap.noLossesMatched')
  }

  const rows = trades
    .map((trade) => {
      const direction = trade.direction ? t(`trades.direction.${trade.direction}`) : ''
      return `| ${trade.symbol} | ${direction} | ${formatDateTime(trade.closedAt, timezone)} | ${(trade.pnlNet ?? 0).toFixed(2)} | ${trade.setup ?? ''} |`
    })
    .join('\n')

  return [
    `## ${t('notebook.lossRecap.title')}`,
    '',
    `| ${t('notebook.lossRecap.table.symbol')} | ${t('notebook.lossRecap.table.direction')} | ${t('notebook.lossRecap.table.closed')} | ${t('notebook.lossRecap.table.netPnl')} | ${t('notebook.lossRecap.table.setup')} |`,
    '| --- | --- | --- | --- | --- |',
    rows,
    '',
    `### ${t('notebook.lossRecap.reflectionTitle')}`,
    `- ${t('notebook.lossRecap.promptMistake')}`,
    `- ${t('notebook.lossRecap.promptRule')}`,
    `- ${t('notebook.lossRecap.promptFix')}`
  ].join('\n')
}

const parseStoredFilters = (): AdvancedNoteFilters => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.filters)
    if (!raw) return defaultFilters
    const parsed = JSON.parse(raw) as Partial<AdvancedNoteFilters>
    return {
      folderId: typeof parsed.folderId === 'string' ? parsed.folderId : '',
      type: parsed.type && ['DAILY_LOG', 'TRADE_NOTE', 'PLAN', 'GOAL', 'SESSION_RECAP', 'NOTE', 'ALL'].includes(parsed.type) ? parsed.type : 'ALL',
      tagIds: Array.isArray(parsed.tagIds) ? parsed.tagIds : [],
      from: typeof parsed.from === 'string' ? parsed.from : '',
      to: typeof parsed.to === 'string' ? parsed.to : '',
      linkedTrade: parsed.linkedTrade === 'YES' || parsed.linkedTrade === 'NO' ? parsed.linkedTrade : 'ALL',
      hasAttachments: parsed.hasAttachments === 'YES' || parsed.hasAttachments === 'NO' ? parsed.hasAttachments : 'ALL'
    }
  } catch {
    return defaultFilters
  }
}

const parseStoredNavigation = (): NotebookNavigationState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.nav)
    if (!raw) return { kind: 'smart', key: 'ALL_NOTES' }
    const parsed = JSON.parse(raw) as NotebookNavigationState
    if (parsed.kind === 'smart') {
      const valid = ['ALL_NOTES', 'DAILY_LOGS', 'PLANS', 'RECAPS', 'PINNED', 'RECENTLY_DELETED'].includes(parsed.key)
      if (valid) return parsed
      return { kind: 'smart', key: 'ALL_NOTES' }
    }
    if (parsed.kind === 'folder' && typeof parsed.folderId === 'string') {
      return parsed
    }
    return { kind: 'smart', key: 'ALL_NOTES' }
  } catch {
    return { kind: 'smart', key: 'ALL_NOTES' }
  }
}

const parseReview = (reviewJson?: string | null): NoteReview => {
  if (!reviewJson) return defaultReview
  try {
    const parsed = JSON.parse(reviewJson) as Partial<NoteReview>
    return {
      setupQuality: parsed.setupQuality === 'A' || parsed.setupQuality === 'B' || parsed.setupQuality === 'C' ? parsed.setupQuality : null,
      followedPlan: typeof parsed.followedPlan === 'boolean' ? parsed.followedPlan : null,
      ruleBreaks: Array.isArray(parsed.ruleBreaks) ? parsed.ruleBreaks.filter((value): value is NoteReviewRuleBreak => reviewRuleBreakOptions.includes(value as NoteReviewRuleBreak)) : [],
      didWell: typeof parsed.didWell === 'string' ? parsed.didWell : '',
      improveNext: typeof parsed.improveNext === 'string' ? parsed.improveNext : '',
      nextRule: typeof parsed.nextRule === 'string' ? parsed.nextRule : ''
    }
  } catch {
    return defaultReview
  }
}

export default function NotebookPage() {
  const { t } = useI18n()
  const { logout, user } = useAuth()
  const { refreshToken } = useDemoData()
  const navigate = useNavigate()
  const location = useLocation()

  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'

  const isMobile = useMediaQuery('(max-width: 899.98px)')
  const isDesktop = useMediaQuery('(min-width: 900px)')

  const [folders, setFolders] = useState<NotebookFolder[]>([])
  const [tags, setTags] = useState<NotebookTag[]>([])
  const [notes, setNotes] = useState<NotebookNote[]>([])
  const [selectedNote, setSelectedNote] = useState<NotebookNote | null>(null)
  const [noteTags, setNoteTags] = useState<NotebookTag[]>([])
  const [navigation, setNavigation] = useState<NotebookNavigationState>(parseStoredNavigation)
  const [filters, setFilters] = useState<AdvancedNoteFilters>(parseStoredFilters)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<NoteSortOrder>('updated')
  const [viewMode, setViewMode] = useState<NotePanelMode>('read')
  const [contentTab, setContentTab] = useState<NoteContentTab>('content')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showUndoDelete, setShowUndoDelete] = useState(false)
  const [lastDeletedNote, setLastDeletedNote] = useState<NotebookNote | null>(null)
  const [listCollapsed, setListCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.listCollapsed) === 'true')
  const [metaCollapsed, setMetaCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.metaCollapsed) === 'true')
  const [mobilePanel, setMobilePanel] = useState<'list' | 'note'>('list')
  const [navigationDrawerOpen, setNavigationDrawerOpen] = useState(false)
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false)
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)
  const [editorMenuAnchor, setEditorMenuAnchor] = useState<HTMLElement | null>(null)
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<HTMLElement | null>(null)
  const [folderMenuTarget, setFolderMenuTarget] = useState<string | null>(null)
  const [foldersCollapsed, setFoldersCollapsed] = useState(false)

  const [templates, setTemplates] = useState<NotebookTemplate[]>([])
  const [allTemplates, setAllTemplates] = useState<NotebookTemplate[]>([])
  const [templateSelection, setTemplateSelection] = useState('')
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [newTemplateId, setNewTemplateId] = useState('')

  const [attachments, setAttachments] = useState<NotebookAttachment[]>([])
  const [attachmentUploads, setAttachmentUploads] = useState<UploadQueueItem[]>([])

  const [tradeDetail, setTradeDetail] = useState<TradeResponse | null>(null)
  const [tradeSearchQuery, setTradeSearchQuery] = useState('')
  const [tradeSearchResults, setTradeSearchResults] = useState<TradeResponse[]>([])
  const [tradeSearchLoading, setTradeSearchLoading] = useState(false)

  const [lossRecapOpen, setLossRecapOpen] = useState(false)
  const [lossRecapForm, setLossRecapForm] = useState<LossRecapForm>(defaultLossRecap)

  const persistedFingerprintRef = useRef('')
  const isSavingRef = useRef(false)

  const urlNoteId = useMemo(() => new URLSearchParams(location.search).get('noteId'), [location.search])

  const smartFolders = useMemo(() => {
    const map = new Map<string, NotebookFolder>()
    folders.forEach((folder) => {
      if (folder.systemKey) {
        map.set(folder.systemKey, folder)
      }
    })
    return map
  }, [folders])

  const customFolders = useMemo(() => folders.filter((folder) => !folder.systemKey), [folders])
  const tagsMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])

  const resolveQueryFolderId = useCallback(() => {
    if (filters.folderId) {
      return filters.folderId
    }
    if (navigation.kind === 'folder') {
      return navigation.folderId
    }
    const systemKey = smartViewToSystemKey[navigation.key]
    return smartFolders.get(systemKey)?.id
  }, [filters.folderId, navigation, smartFolders])

  const confirmDiscard = useCallback(() => {
    if (!isDirty) return true
    return window.confirm(t('notebook.prompts.discardChanges'))
  }, [isDirty, t])

  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(t('notebook.prompts.discardAndContinue'))) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker, t])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.nav, JSON.stringify(navigation))
  }, [navigation])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters))
  }, [filters])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.listCollapsed, listCollapsed ? 'true' : 'false')
  }, [listCollapsed])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.metaCollapsed, metaCollapsed ? 'true' : 'false')
  }, [metaCollapsed])

  useEffect(() => {
    if (contentTab === 'review' && !selectedNote?.relatedTradeId) {
      setContentTab('content')
    }
  }, [contentTab, selectedNote?.relatedTradeId])

  useEffect(() => {
    if (!selectedNote?.id) {
      setAttachments([])
      setAttachmentUploads([])
      return
    }
    const loadAttachments = async () => {
      try {
        const data = await listNotebookAttachments(selectedNote.id)
        setAttachments(data)
      } catch {
        setAttachments([])
      }
    }
    void loadAttachments()
  }, [selectedNote?.id, refreshToken])

  useEffect(() => {
    if (!selectedNote?.relatedTradeId) {
      setTradeDetail(null)
      return
    }
    const loadTrade = async () => {
      try {
        const data = await getTradeById(selectedNote.relatedTradeId as string)
        setTradeDetail(data)
      } catch {
        setTradeDetail(null)
      }
    }
    void loadTrade()
  }, [selectedNote?.relatedTradeId, refreshToken])

  useEffect(() => {
    const query = tradeSearchQuery.trim()
    if (query.length < 1) {
      setTradeSearchResults([])
      return
    }
    let cancelled = false
    setTradeSearchLoading(true)
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await searchTrades({ symbol: query, page: 0, size: 8 })
        if (!cancelled) {
          setTradeSearchResults(result.content || [])
        }
      } catch {
        if (!cancelled) {
          setTradeSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setTradeSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [tradeSearchQuery])

  const handleAuthFailure = useCallback((message?: string) => {
    setError(message || t('notebook.errors.loginRequired'))
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate, t])

  const loadFoldersAndTags = useCallback(async () => {
    try {
      const [folderData, tagData, globalTemplates] = await Promise.all([
        listNotebookFolders(),
        listNotebookTags(),
        listNotebookTemplates()
      ])
      setFolders(folderData)
      setTags(tagData)
      setAllTemplates(globalTemplates)

      setNavigation((prev) => {
        if (prev.kind === 'folder') {
          const folderExists = folderData.some((folder) => folder.id === prev.folderId)
          if (!folderExists) {
            return { kind: 'smart', key: 'ALL_NOTES' }
          }
        }
        return prev
      })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
        return
      }
      setError(translateApiError(err, t, 'notebook.errors.loadFolders'))
    }
  }, [handleAuthFailure, t])

  const loadNotes = useCallback(async () => {
    const folderId = resolveQueryFolderId()
    if (!folderId) return

    setLoading(true)
    try {
      const data = await listNotebookNotes({
        folderId,
        type: filters.type === 'ALL' ? undefined : filters.type,
        q: searchQuery,
        tagIds: filters.tagIds,
        from: filters.from || undefined,
        to: filters.to || undefined,
        sort: sortOrder
      })

      let filtered = data

      if (navigation.kind === 'smart' && navigation.key === 'PINNED') {
        filtered = filtered.filter((note) => note.isPinned)
      }

      if (filters.linkedTrade === 'YES') {
        filtered = filtered.filter((note) => Boolean(note.relatedTradeId))
      }
      if (filters.linkedTrade === 'NO') {
        filtered = filtered.filter((note) => !note.relatedTradeId)
      }

      if (filters.hasAttachments === 'YES') {
        filtered = filtered.filter((note) => Boolean(note.hasAttachments))
      }
      if (filters.hasAttachments === 'NO') {
        filtered = filtered.filter((note) => !note.hasAttachments)
      }

      setNotes(filtered)

      if (!urlNoteId) {
        setSelectedNote((prev) => {
          if (!filtered.length) return null
          if (prev && filtered.some((note) => note.id === prev.id)) {
            return prev
          }
          return filtered[0]
        })
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
        return
      }
      setError(translateApiError(err, t, 'notebook.errors.loadNotes'))
    } finally {
      setLoading(false)
    }
  }, [filters, handleAuthFailure, navigation, resolveQueryFolderId, searchQuery, sortOrder, t, urlNoteId])

  const refreshSelectedNote = useCallback(async (noteId: string) => {
    try {
      const data = await getNotebookNote(noteId)
      setSelectedNote(data)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.refreshNote'))
      }
    }
  }, [handleAuthFailure, t])

  useEffect(() => {
    void loadFoldersAndTags()
  }, [loadFoldersAndTags, refreshToken])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes, refreshToken])

  useEffect(() => {
    if (!urlNoteId) return
    void refreshSelectedNote(urlNoteId)
  }, [refreshSelectedNote, urlNoteId])

  useEffect(() => {
    if (!selectedNote) {
      setNoteTags([])
      setTemplates([])
      return
    }

    const mappedTags = tags.filter((tag) => selectedNote.tagIds?.includes(tag.id))
    setNoteTags(mappedTags)

    const loadTemplates = async () => {
      try {
        const data = await listNotebookTemplates(selectedNote.type)
        setTemplates(data)
      } catch {
        setTemplates([])
      }
    }

    void loadTemplates()
  }, [selectedNote, tags, refreshToken])

  useEffect(() => {
    persistedFingerprintRef.current = buildNoteFingerprint(selectedNote)
    setIsDirty(false)
    setSaveState('idle')
    setLastSavedAt(selectedNote?.updatedAt ?? null)
    setTemplateSelection('')
    if (selectedNote) {
      setViewMode('read')
      setContentTab('content')
    }
    if (isMobile) {
      setMobilePanel(selectedNote ? 'note' : 'list')
    }
  }, [isMobile, selectedNote?.id, selectedNote?.updatedAt])

  const updateDraftNote = useCallback((next: NotebookNote) => {
    setSelectedNote(next)
    setIsDirty(buildNoteFingerprint(next) !== persistedFingerprintRef.current)
    setSaveState('idle')
  }, [])

  const upsertNote = useCallback((note: NotebookNote) => {
    setNotes((prev) => {
      const index = prev.findIndex((item) => item.id === note.id)
      const next = index >= 0 ? prev.map((item) => (item.id === note.id ? note : item)) : [note, ...prev]
      return next
    })
  }, [])

  const handleCreateNote = async (type: NotebookNoteType, fromTemplate?: NotebookTemplate | null) => {
    if (!confirmDiscard()) return

    try {
      const folderId = (() => {
        if (navigation.kind === 'folder') return navigation.folderId
        if (filters.folderId) return filters.folderId
        return undefined
      })()

      const dateKey = new Date().toISOString().slice(0, 10)
      const note = await createNotebookNote({
        type,
        title: type === 'DAILY_LOG'
          ? t('notebook.defaultTitle.dailyLog', { date: formatDate(new Date().toISOString()) })
          : t('notebook.defaultTitle.untitledNote'),
        dateKey,
        folderId,
        body: fromTemplate?.content ? extractPlainText(fromTemplate.content) : undefined,
        bodyJson: fromTemplate?.content ? JSON.stringify({ format: 'html', content: fromTemplate.content }) : undefined,
        isPinned: false
      })

      setSelectedNote(note)
      setViewMode('edit')
      setContentTab('content')
      setSaveState('saved')
      setLastSavedAt(note.updatedAt ?? null)
      upsertNote(note)
      navigate(`/notebook?noteId=${note.id}`, { replace: true })

      if (isMobile) {
        setMobilePanel('note')
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.createNote'))
      }
    }
  }

  const handleSaveNote = useCallback(async () => {
    if (!selectedNote) return
    if (isSavingRef.current) return
    if (viewMode !== 'edit') return

    if (selectedNote.type === 'DAILY_LOG' && (!selectedNote.dateKey || !selectedNote.dateKey.trim())) {
      setError(t('notebook.validation.dailyLogDateRequired'))
      return
    }

    try {
      isSavingRef.current = true
      setSaveState('saving')
      setError('')

      const resolvedHtml = resolveNoteHtml(selectedNote)
      const payloadBodyJson = selectedNote.bodyJson && selectedNote.bodyJson.trim()
        ? selectedNote.bodyJson
        : JSON.stringify({ format: 'html', content: resolvedHtml })

      const payloadBody = selectedNote.body && selectedNote.body.trim()
        ? selectedNote.body
        : extractPlainText(resolvedHtml)

      const updated = await updateNotebookNote(selectedNote.id, {
        title: selectedNote.title,
        body: payloadBody,
        bodyJson: payloadBodyJson,
        dateKey: selectedNote.dateKey && selectedNote.dateKey.trim() ? selectedNote.dateKey : null,
        clearDateKey: !(selectedNote.dateKey && selectedNote.dateKey.trim()),
        folderId: selectedNote.folderId,
        clearFolder: !selectedNote.folderId,
        type: selectedNote.type,
        relatedTradeId: selectedNote.relatedTradeId,
        clearRelatedTrade: !selectedNote.relatedTradeId,
        isPinned: selectedNote.isPinned,
        reviewJson: selectedNote.reviewJson ?? null,
        clearReview: !selectedNote.reviewJson
      })

      persistedFingerprintRef.current = buildNoteFingerprint(updated)
      setSelectedNote(updated)
      setIsDirty(false)
      setSaveState('saved')
      setLastSavedAt(updated.updatedAt ?? null)
      upsertNote(updated)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setSaveState('error')
        setError(translateApiError(err, t, 'notebook.errors.saveNote'))
      }
    } finally {
      isSavingRef.current = false
    }
  }, [handleAuthFailure, selectedNote, t, upsertNote, viewMode])

  useEffect(() => {
    if (!selectedNote || !isDirty || viewMode !== 'edit' || saveState === 'saving') return
    const timeoutId = window.setTimeout(() => {
      void handleSaveNote()
    }, 1200)
    return () => window.clearTimeout(timeoutId)
  }, [handleSaveNote, isDirty, saveState, selectedNote, viewMode])

  const handleDeleteNote = async () => {
    if (!selectedNote) return
    if (!window.confirm(t('notebook.prompts.moveToRecentlyDeleted'))) return

    try {
      await deleteNotebookNote(selectedNote.id)
      setLastDeletedNote(selectedNote)
      setSelectedNote(null)
      setNotes((prev) => prev.filter((item) => item.id !== selectedNote.id))
      setShowUndoDelete(true)
      navigate('/notebook', { replace: true })
      if (isMobile) {
        setMobilePanel('list')
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.deleteNote'))
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
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.restoreNote'))
      }
    }
  }

  const handleUndoDelete = async () => {
    if (!lastDeletedNote) return
    try {
      const restored = await restoreNotebookNote(lastDeletedNote.id)
      setSelectedNote(restored)
      upsertNote(restored)
      setShowUndoDelete(false)
      setLastDeletedNote(null)
      navigate(`/notebook?noteId=${restored.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.restoreNote'))
      }
    }
  }

  const handleDuplicateNote = async () => {
    if (!selectedNote) return
    try {
      const duplicate = await createNotebookNote({
        type: selectedNote.type,
        folderId: selectedNote.folderId,
        title: `${selectedNote.title || t('notebook.defaultTitle.untitledNote')} (${t('notebook.labels.copySuffix')})`,
        body: selectedNote.body,
        bodyJson: selectedNote.bodyJson,
        dateKey: selectedNote.dateKey,
        relatedTradeId: selectedNote.relatedTradeId,
        reviewJson: selectedNote.reviewJson,
        isPinned: false
      })
      upsertNote(duplicate)
      setSelectedNote(duplicate)
      navigate(`/notebook?noteId=${duplicate.id}`, { replace: true })
      setViewMode('edit')
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.createNote'))
      }
    }
  }

  const handleExportNote = () => {
    if (!selectedNote) return
    const html = resolveNoteHtml(selectedNote)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const filename = (selectedNote.title || 'note').replace(/\s+/g, '-').toLowerCase()
    anchor.href = url
    anchor.download = `${filename}.html`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const handleApplyTemplate = () => {
    if (!selectedNote || !templateSelection) return
    const template = templates.find((item) => item.id === templateSelection)
    if (!template) return
    const html = template.content || ''
    updateDraftNote({
      ...selectedNote,
      body: extractPlainText(html),
      bodyJson: JSON.stringify({ format: 'html', content: html })
    })
  }

  const handleSaveTemplate = async () => {
    if (!selectedNote) return
    const name = window.prompt(t('notebook.prompts.templateName'))
    if (!name) return
    try {
      await createNotebookTemplate({
        name,
        appliesToType: selectedNote.type,
        content: resolveNoteHtml(selectedNote)
      })
      const [typedTemplates, globalTemplates] = await Promise.all([
        listNotebookTemplates(selectedNote.type),
        listNotebookTemplates()
      ])
      setTemplates(typedTemplates)
      setAllTemplates(globalTemplates)
    } catch {
      // no-op
    }
  }

  const handleInsertDailyTemplate = () => {
    if (!selectedNote) return
    const html = [
      `<h2>${t('notebook.dailyTemplate.sessionBias')}</h2>`,
      '<p></p>',
      `<h2>${t('notebook.dailyTemplate.keyLevels')}</h2>`,
      '<ul><li></li></ul>',
      `<h2>${t('notebook.dailyTemplate.newsAndCatalysts')}</h2>`,
      '<ul><li></li></ul>',
      `<h2>${t('notebook.dailyTemplate.rulesToExecute')}</h2>`,
      '<ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox" /></label><div><p></p></div></li></ul>',
      `<h2>${t('notebook.dailyTemplate.postSessionReview')}</h2>`,
      '<p></p>'
    ].join('')
    updateDraftNote({
      ...selectedNote,
      body: extractPlainText(html),
      bodyJson: JSON.stringify({ format: 'html', content: html })
    })
  }

  const handleUpdateTags = async (value: NotebookTag[]) => {
    if (!selectedNote) return
    setNoteTags(value)
    try {
      await replaceNotebookNoteTags(selectedNote.id, value.map((item) => item.id))
      await refreshSelectedNote(selectedNote.id)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure(err.message)
      }
    }
  }

  const handleAddFolder = async () => {
    const name = window.prompt(t('notebook.prompts.folderName'))
    if (!name) return

    try {
      const folder = await createNotebookFolder({ name })
      setFolders((prev) => [...prev, folder])
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.createFolder'))
      }
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteNotebookFolder(folderId)
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
      if (navigation.kind === 'folder' && navigation.folderId === folderId) {
        setNavigation({ kind: 'smart', key: 'ALL_NOTES' })
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.deleteFolder'))
      }
    }
  }

  const handleAddTag = async () => {
    const name = window.prompt(t('notebook.prompts.newTagName'))
    if (!name) return

    try {
      const tag = await createNotebookTag({ name })
      setTags((prev) => [...prev, tag])
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.createTag'))
      }
    }
  }

  const updateAttachmentUpload = (id: string, patch: Partial<UploadQueueItem>) => {
    setAttachmentUploads((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const handleUploadAttachments = async (files: File[]) => {
    if (!selectedNote || files.length === 0) return

    const queueItems: UploadQueueItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      sizeBytes: file.size,
      progress: 2
    }))
    setAttachmentUploads((prev) => [...prev, ...queueItems])

    await Promise.all(queueItems.map(async (queueItem, index) => {
      const file = files[index]
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        updateAttachmentUpload(queueItem.id, { progress: 0, error: t('assets.errors.tooLarge') })
        return
      }
      if (file.type && !ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
        updateAttachmentUpload(queueItem.id, { progress: 0, error: t('assets.errors.typeNotAllowed') })
        return
      }

      try {
        const uploaded = await uploadNotebookAttachment(selectedNote.id, file, (progress) => {
          updateAttachmentUpload(queueItem.id, { progress })
        })
        setAttachments((prev) => [...prev, uploaded])
        setAttachmentUploads((prev) => prev.filter((item) => item.id !== queueItem.id))
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleAuthFailure()
          return
        }
        updateAttachmentUpload(queueItem.id, {
          progress: 0,
          error: translateApiError(err, t, 'notebook.errors.uploadAttachment')
        })
      }
    }))

    try {
      const updatedList = await listNotebookAttachments(selectedNote.id)
      setAttachments(updatedList)
      setNotes((prev) => prev.map((item) => (item.id === selectedNote.id ? { ...item, hasAttachments: updatedList.length > 0 } : item)))
    } catch {
      // keep optimistic list
    }
  }

  const handleDownloadAttachment = async (attachment: NotebookAttachment) => {
    const targetUrl = attachment.downloadUrl || attachment.url || attachment.viewUrl
    if (!targetUrl) return

    if (targetUrl.startsWith('/api/')) {
      try {
        const blob = await fetchAssetBlob(targetUrl)
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = attachment.fileName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(objectUrl)
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleAuthFailure()
        } else {
          setError(translateApiError(err, t, 'notebook.errors.downloadAttachment'))
        }
      }
      return
    }

    window.open(resolveAssetUrl(targetUrl), '_blank', 'noopener,noreferrer')
  }

  const handleDeleteAttachment = async (id: string) => {
    try {
      await deleteNotebookAttachment(id)
      const remainingCount = attachments.filter((item) => item.id !== id).length
      setAttachments((prev) => prev.filter((item) => item.id !== id))
      if (selectedNote) {
        setNotes((prev) => prev.map((item) => (item.id === selectedNote.id ? { ...item, hasAttachments: remainingCount > 0 } : item)))
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.deleteAttachment'))
      }
    }
  }

  const handleLossRecap = async () => {
    if (!confirmDiscard()) return
    try {
      const losses = await listLosses(lossRecapForm.from, lossRecapForm.to, timezone, lossRecapForm.minLoss)
      const markdown = buildLossRecapBody(losses as TradeResponse[], t, timezone)
      const html = convertMarkdownToHtml(markdown)
      const note = await createNotebookNote({
        type: 'SESSION_RECAP',
        title: t('notebook.lossRecap.noteTitle', { from: lossRecapForm.from, to: lossRecapForm.to }),
        body: extractPlainText(html),
        bodyJson: JSON.stringify({ format: 'html', content: html })
      })
      setSelectedNote(note)
      upsertNote(note)
      setLossRecapOpen(false)
      navigate(`/notebook?noteId=${note.id}`, { replace: true })
      setViewMode('edit')
      setContentTab('content')
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleAuthFailure()
      } else {
        setError(translateApiError(err, t, 'notebook.errors.createLossRecap'))
      }
    }
  }

  const handleSelectSmartView = (key: NotebookSmartViewKey) => {
    if (!confirmDiscard()) return
    setNavigation({ kind: 'smart', key })
    setFilters((prev) => ({ ...prev, folderId: '' }))
    setNavigationDrawerOpen(false)
    if (isMobile) {
      setMobilePanel('list')
    }
  }

  const handleSelectFolder = (folderId: string) => {
    if (!confirmDiscard()) return
    setNavigation({ kind: 'folder', folderId })
    setNavigationDrawerOpen(false)
    if (isMobile) {
      setMobilePanel('list')
    }
  }

  const handleSelectNote = (note: NotebookNote) => {
    if (selectedNote?.id === note.id) return
    if (!confirmDiscard()) return
    setSelectedNote(note)
    setViewMode('read')
    setContentTab('content')
    navigate(`/notebook?noteId=${note.id}`)
    if (isMobile) {
      setMobilePanel('note')
    }
  }

  const handleLinkTrade = (trade: TradeResponse | null) => {
    if (!selectedNote || !trade) return
    updateDraftNote({
      ...selectedNote,
      relatedTradeId: trade.id
    })
    setTradeDetail(trade)
    setTradeSearchQuery('')
    setTradeSearchResults([])
  }

  const handleUnlinkTrade = () => {
    if (!selectedNote) return
    updateDraftNote({
      ...selectedNote,
      relatedTradeId: null,
      reviewJson: null
    })
    setTradeDetail(null)
    setContentTab('content')
  }

  const review = useMemo(() => parseReview(selectedNote?.reviewJson), [selectedNote?.reviewJson])

  const updateReview = (patch: Partial<NoteReview>) => {
    if (!selectedNote) return
    const nextReview = {
      ...review,
      ...patch
    }
    updateDraftNote({
      ...selectedNote,
      reviewJson: JSON.stringify(nextReview)
    })
  }

  const appliedFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onDelete: () => void }[] = []

    if (filters.folderId) {
      const folderName = customFolders.find((folder) => folder.id === filters.folderId)?.name || t('notebook.fields.folder')
      chips.push({
        id: 'folder',
        label: `${t('notebook.fields.folder')}: ${folderName}`,
        onDelete: () => setFilters((prev) => ({ ...prev, folderId: '' }))
      })
    }

    if (filters.type !== 'ALL') {
      chips.push({
        id: 'type',
        label: `${t('notebook.fields.type')}: ${t(`notebook.noteType.${filters.type}`)}`,
        onDelete: () => setFilters((prev) => ({ ...prev, type: 'ALL' }))
      })
    }

    filters.tagIds.forEach((tagId) => {
      const tag = tagsMap.get(tagId)
      if (!tag) return
      chips.push({
        id: `tag-${tagId}`,
        label: `#${tag.name}`,
        onDelete: () => setFilters((prev) => ({ ...prev, tagIds: prev.tagIds.filter((id) => id !== tagId) }))
      })
    })

    if (filters.from || filters.to) {
      chips.push({
        id: 'date',
        label: `${t('notebook.fields.date')}: ${filters.from || '...'} - ${filters.to || '...'}`,
        onDelete: () => setFilters((prev) => ({ ...prev, from: '', to: '' }))
      })
    }

    if (filters.linkedTrade !== 'ALL') {
      chips.push({
        id: 'linkedTrade',
        label: `${t('notebook.fields.linkedTrade')}: ${filters.linkedTrade === 'YES' ? t('common.yes') : t('common.no')}`,
        onDelete: () => setFilters((prev) => ({ ...prev, linkedTrade: 'ALL' }))
      })
    }

    if (filters.hasAttachments !== 'ALL') {
      chips.push({
        id: 'hasAttachments',
        label: `${t('notebook.fields.hasAttachments')}: ${filters.hasAttachments === 'YES' ? t('common.yes') : t('common.no')}`,
        onDelete: () => setFilters((prev) => ({ ...prev, hasAttachments: 'ALL' }))
      })
    }

    return chips
  }, [customFolders, filters, t, tagsMap])

  const smartViews = useMemo(() => ([
    { key: 'ALL_NOTES' as NotebookSmartViewKey, label: t('notebook.smartViews.allNotes'), icon: <MenuBookIcon fontSize="small" /> },
    { key: 'DAILY_LOGS' as NotebookSmartViewKey, label: t('notebook.smartViews.dailyLogs'), icon: <MenuBookIcon fontSize="small" /> },
    { key: 'PLANS' as NotebookSmartViewKey, label: t('notebook.smartViews.plans'), icon: <MenuBookIcon fontSize="small" /> },
    { key: 'RECAPS' as NotebookSmartViewKey, label: t('notebook.smartViews.recaps'), icon: <MenuBookIcon fontSize="small" /> },
    { key: 'PINNED' as NotebookSmartViewKey, label: t('notebook.smartViews.pinned'), icon: <PushPinIcon fontSize="small" /> },
    { key: 'RECENTLY_DELETED' as NotebookSmartViewKey, label: t('notebook.smartViews.recentlyDeleted'), icon: <DeleteOutlineIcon fontSize="small" /> }
  ]), [t])

  const leftRailPanel = (
    <Stack sx={{ minHeight: 0, height: '100%' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sections.smartViews')}</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddFolder}>{t('notebook.actions.addFolder')}</Button>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1 }}>
        <List disablePadding>
          {smartViews.map((view) => (
            <ListItemButton
              key={view.key}
              selected={navigation.kind === 'smart' && navigation.key === view.key}
              onClick={() => handleSelectSmartView(view.key)}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {view.icon}
                <ListItemText primary={view.label} />
              </Stack>
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, mb: 0.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sections.folders')}</Typography>
            <IconButton size="small" onClick={() => setFoldersCollapsed((prev) => !prev)}>
              {foldersCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
          </Stack>
          <Button size="small" onClick={handleAddFolder}>{t('notebook.actions.add')}</Button>
        </Stack>

        {!foldersCollapsed && (
          <>
            {customFolders.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                {t('notebook.empty.noFolders')}
              </Typography>
            )}

            <List disablePadding>
              {customFolders.map((folder) => (
                <ListItemButton
                  key={folder.id}
                  selected={navigation.kind === 'folder' && navigation.folderId === folder.id}
                  onClick={() => handleSelectFolder(folder.id)}
                  sx={{ borderRadius: 2, mb: 0.5, pr: 1 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
                    {navigation.kind === 'folder' && navigation.folderId === folder.id ? (
                      <FolderIcon fontSize="small" />
                    ) : (
                      <FolderOutlinedIcon fontSize="small" />
                    )}
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>{folder.name}</Typography>
                    <IconButton
                      size="small"
                      onClick={(event: MouseEvent<HTMLElement>) => {
                        event.stopPropagation()
                        setFolderMenuAnchor(event.currentTarget)
                        setFolderMenuTarget(folder.id)
                      }}
                      aria-label={t('notebook.aria.folderActions')}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button variant="text" onClick={handleAddTag}>{t('notebook.actions.addTag')}</Button>
      </Box>
    </Stack>
  )

  const editorValue = useMemo(() => resolveNoteHtml(selectedNote), [selectedNote])

  const rightPanel = (
    <Stack sx={{ minHeight: 0, height: '100%' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        {!selectedNote ? (
          <Typography variant="subtitle1" fontWeight={700}>{t('notebook.sections.editor')}</Typography>
        ) : (
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              {isMobile ? (
                <Button size="small" startIcon={<ViewListIcon />} onClick={() => setMobilePanel('list')} sx={{ minHeight: 44 }}>
                  {t('notebook.actions.list')}
                </Button>
              ) : (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Chip size="small" label={t(`notebook.noteType.${selectedNote.type}`)} />
                  {selectedNote.isPinned && <Chip size="small" label={t('notebook.filterType.PINNED')} />}
                </Stack>
              )}

              <Stack direction="row" spacing={0.5}>
                <Tooltip title={selectedNote.isPinned ? t('notebook.actions.unpinNote') : t('notebook.actions.pinNote')}>
                  <IconButton onClick={() => updateDraftNote({ ...selectedNote, isPinned: !selectedNote.isPinned })} sx={isMobile ? { minWidth: 44, minHeight: 44 } : undefined}>
                    {selectedNote.isPinned ? <StarIcon color="warning" fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <ToggleButtonGroup
                  size="small"
                  value={viewMode}
                  exclusive
                  onChange={(_, value) => value && setViewMode(value)}
                >
                  <ToggleButton value="read" aria-label={t('notebook.aria.readMode')}>
                    <VisibilityIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="edit" aria-label={t('notebook.aria.editMode')}>
                    <EditIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
                {!isMobile && (
                  <Tooltip title={metaCollapsed ? t('notebook.actions.showInfo') : t('notebook.actions.hideInfo')}>
                    <IconButton onClick={() => setMetaCollapsed((prev) => !prev)}>
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isMobile && (
                  <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => setMetaDrawerOpen(true)} sx={{ minHeight: 44 }}>
                    {t('notebook.actions.info')}
                  </Button>
                )}
                <IconButton onClick={(event) => setEditorMenuAnchor(event.currentTarget)} aria-label={t('notebook.aria.moreActions')}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Box>
              {viewMode === 'edit' ? (
                <TextField
                  size="small"
                  value={selectedNote.title ?? ''}
                  onChange={(event) => updateDraftNote({ ...selectedNote, title: event.target.value })}
                  placeholder={t('notebook.fields.title')}
                  fullWidth
                />
              ) : (
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {selectedNote.title || t('notebook.defaultTitle.untitledNote')}
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              {selectedNote.relatedTradeId ? (
                <Tabs
                  value={contentTab}
                  onChange={(_, value) => setContentTab(value)}
                  sx={{ minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5 } }}
                >
                  <Tab value="content" label={t('notebook.tabs.content')} />
                  <Tab value="review" label={t('notebook.tabs.review')} />
                </Tabs>
              ) : (
                <Typography variant="caption" color="text.secondary">{t('notebook.tabs.content')}</Typography>
              )}

              <Typography variant="caption" color="text.secondary">
                {saveState === 'saving' && t('notebook.saveState.saving')}
                {saveState === 'error' && t('notebook.saveState.error')}
                {saveState === 'saved' && lastSavedAt && t('notebook.saveState.savedAt', { date: formatDateTime(lastSavedAt, timezone) })}
                {saveState === 'idle' && (isDirty ? t('notebook.saveState.unsaved') : t('notebook.saveState.allSaved'))}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Box>

      {!selectedNote ? (
        <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
          <EmptyState
            title={t('emptyState.selectNote')}
            description={t('emptyState.selectNoteBody')}
          />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: isDesktop ? (metaCollapsed ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 340px') : '1fr'
          }}
        >
          <Box sx={{ minHeight: 0, overflowY: 'auto', p: 2 }}>
            {contentTab === 'content' ? (
              viewMode === 'read' ? (
                <NoteViewer html={editorValue} emptyText={t('editor.placeholder')} />
              ) : (
                <NoteEditor
                  value={editorValue}
                  compactToolbar={isMobile}
                  onChange={(html) => {
                    if (!selectedNote) return
                    updateDraftNote({
                      ...selectedNote,
                      body: extractPlainText(html),
                      bodyJson: JSON.stringify({ format: 'html', content: html })
                    })
                  }}
                />
              )
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>{t('notebook.review.title')}</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    select
                    label={t('notebook.review.setupQuality')}
                    value={review.setupQuality || ''}
                    onChange={(event) => updateReview({ setupQuality: (event.target.value || null) as NoteReview['setupQuality'] })}
                    disabled={viewMode === 'read'}
                    fullWidth
                  >
                    <MenuItem value="">{t('common.none')}</MenuItem>
                    <MenuItem value="A">A</MenuItem>
                    <MenuItem value="B">B</MenuItem>
                    <MenuItem value="C">C</MenuItem>
                  </TextField>

                  <TextField
                    select
                    label={t('notebook.review.followedPlan')}
                    value={review.followedPlan === null ? '' : review.followedPlan ? 'YES' : 'NO'}
                    onChange={(event) => {
                      const value = event.target.value
                      if (!value) {
                        updateReview({ followedPlan: null })
                        return
                      }
                      updateReview({ followedPlan: value === 'YES' })
                    }}
                    disabled={viewMode === 'read'}
                    fullWidth
                  >
                    <MenuItem value="">{t('common.none')}</MenuItem>
                    <MenuItem value="YES">{t('common.yes')}</MenuItem>
                    <MenuItem value="NO">{t('common.no')}</MenuItem>
                  </TextField>
                </Stack>

                <TextField
                  select
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) => (
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        {(selected as string[]).map((item) => (
                          <Chip key={item} size="small" label={t(`notebook.review.ruleBreaksOptions.${item}`)} />
                        ))}
                      </Stack>
                    )
                  }}
                  label={t('notebook.review.ruleBreaks')}
                  value={review.ruleBreaks}
                  onChange={(event) => {
                    const raw = event.target.value
                    const next = (Array.isArray(raw) ? raw : String(raw).split(','))
                      .filter((value): value is NoteReviewRuleBreak => reviewRuleBreakOptions.includes(value as NoteReviewRuleBreak))
                    updateReview({ ruleBreaks: next })
                  }}
                  disabled={viewMode === 'read'}
                  fullWidth
                >
                  {reviewRuleBreakOptions.map((option) => (
                    <MenuItem key={option} value={option}>{t(`notebook.review.ruleBreaksOptions.${option}`)}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  label={t('notebook.review.didWell')}
                  value={review.didWell}
                  onChange={(event) => updateReview({ didWell: event.target.value })}
                  disabled={viewMode === 'read'}
                  multiline
                  minRows={2}
                  fullWidth
                />

                <TextField
                  label={t('notebook.review.improveNext')}
                  value={review.improveNext}
                  onChange={(event) => updateReview({ improveNext: event.target.value })}
                  disabled={viewMode === 'read'}
                  multiline
                  minRows={2}
                  fullWidth
                />

                <TextField
                  label={t('notebook.review.nextRule')}
                  value={review.nextRule}
                  onChange={(event) => updateReview({ nextRule: event.target.value })}
                  disabled={viewMode === 'read'}
                  fullWidth
                />
              </Stack>
            )}
          </Box>

          {isDesktop && !metaCollapsed && (
            <NoteMetaSidebar
              note={selectedNote}
              readOnly={viewMode === 'read'}
              timezone={timezone}
              baseCurrency={baseCurrency}
              folders={folders}
              tags={tags}
              noteTags={noteTags}
              onUpdateNote={(patch) => updateDraftNote({ ...selectedNote, ...patch })}
              onUpdateTags={handleUpdateTags}
              tradeDetail={tradeDetail}
              tradeSearchQuery={tradeSearchQuery}
              tradeSearchResults={tradeSearchResults}
              tradeSearchLoading={tradeSearchLoading}
              onTradeSearchQueryChange={setTradeSearchQuery}
              onLinkTrade={handleLinkTrade}
              onUnlinkTrade={handleUnlinkTrade}
              templates={templates}
              templateSelection={templateSelection}
              onTemplateSelectionChange={setTemplateSelection}
              onApplyTemplate={handleApplyTemplate}
              onSaveTemplate={handleSaveTemplate}
              onInsertDailyTemplate={handleInsertDailyTemplate}
              attachments={attachments}
              uploads={attachmentUploads}
              onUploadAttachments={handleUploadAttachments}
              onDownloadAttachment={handleDownloadAttachment}
              onDeleteAttachment={handleDeleteAttachment}
              saving={saveState === 'saving'}
            />
          )}
        </Box>
      )}
    </Stack>
  )

  return (
    <Stack spacing={1.5} sx={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {error && <ErrorBanner message={error} />}
      {infoMessage && (
        <Alert severity="info" onClose={() => setInfoMessage('')}>
          {infoMessage}
        </Alert>
      )}

      <NotebookLayout
        isMobile={isMobile}
        mobilePanel={mobilePanel}
        leftRail={leftRailPanel}
        middlePanel={
          <NoteList
            notes={notes}
            loading={loading}
            selectedNoteId={selectedNote?.id}
            timezone={timezone}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            appliedFilterChips={appliedFilterChips}
            onOpenNavigation={isMobile ? () => setNavigationDrawerOpen(true) : undefined}
            onOpenFilters={() => setFiltersDrawerOpen(true)}
            onSelectNote={handleSelectNote}
            listCollapsed={isDesktop ? listCollapsed : false}
            onToggleCollapsed={isDesktop ? () => setListCollapsed((prev) => !prev) : undefined}
            newMenu={
              <NewNoteMenu
                onCreate={handleCreateNote}
                onCreateFromTemplate={() => setTemplateDialogOpen(true)}
                onCreateLossRecap={() => setLossRecapOpen(true)}
              />
            }
          />
        }
        rightPanel={rightPanel}
        listCollapsed={isDesktop && listCollapsed}
      />

      {isMobile && (
        <Drawer
          anchor="left"
          open={navigationDrawerOpen}
          onClose={() => setNavigationDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: 320, maxWidth: '90vw' } }}
        >
          {leftRailPanel}
        </Drawer>
      )}

      <FiltersDrawer
        open={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        isMobile={isMobile}
        filters={filters}
        tags={tags}
        folders={folders}
        onApply={(next) => setFilters(next)}
        onReset={() => setFilters(defaultFilters)}
      />

      {isMobile && selectedNote && (
        <Drawer
          anchor="bottom"
          open={metaDrawerOpen}
          onClose={() => setMetaDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              height: '85dvh'
            }
          }}
        >
          <NoteMetaSidebar
            note={selectedNote}
            readOnly={viewMode === 'read'}
            timezone={timezone}
            baseCurrency={baseCurrency}
            folders={folders}
            tags={tags}
            noteTags={noteTags}
            onUpdateNote={(patch) => updateDraftNote({ ...selectedNote, ...patch })}
            onUpdateTags={handleUpdateTags}
            tradeDetail={tradeDetail}
            tradeSearchQuery={tradeSearchQuery}
            tradeSearchResults={tradeSearchResults}
            tradeSearchLoading={tradeSearchLoading}
            onTradeSearchQueryChange={setTradeSearchQuery}
            onLinkTrade={handleLinkTrade}
            onUnlinkTrade={handleUnlinkTrade}
            templates={templates}
            templateSelection={templateSelection}
            onTemplateSelectionChange={setTemplateSelection}
            onApplyTemplate={handleApplyTemplate}
            onSaveTemplate={handleSaveTemplate}
            onInsertDailyTemplate={handleInsertDailyTemplate}
            attachments={attachments}
            uploads={attachmentUploads}
            onUploadAttachments={handleUploadAttachments}
            onDownloadAttachment={handleDownloadAttachment}
            onDeleteAttachment={handleDeleteAttachment}
            saving={saveState === 'saving'}
          />
        </Drawer>
      )}

      <Menu
        anchorEl={editorMenuAnchor}
        open={Boolean(editorMenuAnchor)}
        onClose={() => setEditorMenuAnchor(null)}
      >
        {selectedNote && (
          <MenuItem onClick={() => {
            setEditorMenuAnchor(null)
            void handleDuplicateNote()
          }}>
            {t('notebook.actions.duplicate')}
          </MenuItem>
        )}
        {selectedNote && (
          <MenuItem onClick={() => {
            setEditorMenuAnchor(null)
            handleExportNote()
          }}>
            {t('notebook.actions.export')}
          </MenuItem>
        )}
        {selectedNote?.isDeleted ? (
          <MenuItem onClick={() => {
            setEditorMenuAnchor(null)
            void handleRestoreNote()
          }}>
            {t('notebook.actions.restore')}
          </MenuItem>
        ) : (
          <MenuItem onClick={() => {
            setEditorMenuAnchor(null)
            void handleDeleteNote()
          }}>
            {t('notebook.actions.delete')}
          </MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={folderMenuAnchor}
        open={Boolean(folderMenuAnchor)}
        onClose={() => {
          setFolderMenuAnchor(null)
          setFolderMenuTarget(null)
        }}
      >
        <MenuItem onClick={() => {
          if (folderMenuTarget) {
            void handleDeleteFolder(folderMenuTarget)
          }
          setFolderMenuAnchor(null)
          setFolderMenuTarget(null)
        }}>
          {t('notebook.actions.deleteFolder')}
        </MenuItem>
      </Menu>

      <Dialog open={showUndoDelete} onClose={() => setShowUndoDelete(false)}>
        <DialogTitle>{t('notebook.messages.noteMovedToRecentlyDeleted')}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setShowUndoDelete(false)}>{t('common.close')}</Button>
          <Button onClick={() => void handleUndoDelete()}>{t('notebook.actions.undo')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
        <DialogTitle>{t('notebook.actions.fromTemplate')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1, minWidth: 320 }}>
            <TextField
              select
              label={t('notebook.fields.template')}
              value={newTemplateId}
              onChange={(event) => setNewTemplateId(event.target.value)}
              fullWidth
            >
              <MenuItem value="">{t('common.none')}</MenuItem>
              {allTemplates.map((template) => (
                <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => {
              const template = allTemplates.find((item) => item.id === newTemplateId)
              const type = template?.appliesToType || 'NOTE'
              setTemplateDialogOpen(false)
              setNewTemplateId('')
              void handleCreateNote(type, template)
            }}
            disabled={!newTemplateId}
          >
            {t('notebook.actions.create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={lossRecapOpen} onClose={() => setLossRecapOpen(false)} fullScreen={isMobile}>
        <DialogTitle>{t('notebook.lossRecap.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('notebook.lossRecap.from')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={lossRecapForm.from}
              onChange={(event) => setLossRecapForm((prev) => ({ ...prev, from: event.target.value }))}
            />
            <TextField
              label={t('notebook.lossRecap.to')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={lossRecapForm.to}
              onChange={(event) => setLossRecapForm((prev) => ({ ...prev, to: event.target.value }))}
            />
            <TextField
              label={t('notebook.lossRecap.minLoss')}
              type="number"
              value={lossRecapForm.minLoss}
              onChange={(event) => setLossRecapForm((prev) => ({ ...prev, minLoss: Number(event.target.value) }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLossRecapOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void handleLossRecap()}>{t('notebook.actions.create')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
