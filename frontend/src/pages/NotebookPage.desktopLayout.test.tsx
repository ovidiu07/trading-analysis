import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotebookPage from './NotebookPage'
import { I18nProvider } from '../i18n'

const mockListNotebookFolders = vi.fn()
const mockListNotebookTags = vi.fn()
const mockListNotebookTemplates = vi.fn()
const mockListNotebookNotes = vi.fn()
const mockGetNotebookNote = vi.fn()
const mockUpdateNotebookNote = vi.fn()
const mockCreateNotebookNote = vi.fn()
const mockCreateNotebookFolder = vi.fn()
const mockCreateNotebookTag = vi.fn()
const mockCreateNotebookTemplate = vi.fn()
const mockDeleteNotebookAttachment = vi.fn()
const mockDeleteNotebookFolder = vi.fn()
const mockDeleteNotebookNote = vi.fn()
const mockListLosses = vi.fn()
const mockListNotebookAttachments = vi.fn()
const mockReplaceNotebookNoteTags = vi.fn()
const mockRestoreNotebookNote = vi.fn()
const mockUploadNotebookAttachment = vi.fn()

let notesState: any[] = []

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'trader@example.com',
      timezone: 'Europe/Bucharest',
      baseCurrency: 'USD'
    },
    logout: vi.fn()
  })
}))

vi.mock('../features/demo/DemoDataContext', () => ({
  useDemoData: () => ({
    refreshToken: 0
  })
}))

vi.mock('../api/trades', () => ({
  searchTrades: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 8 }),
  getTradeById: vi.fn().mockResolvedValue(null)
}))

vi.mock('../api/notebook', async () => {
  const actual = await vi.importActual<typeof import('../api/notebook')>('../api/notebook')
  return {
    ...actual,
    listNotebookFolders: (...args: unknown[]) => mockListNotebookFolders(...args),
    listNotebookTags: (...args: unknown[]) => mockListNotebookTags(...args),
    listNotebookTemplates: (...args: unknown[]) => mockListNotebookTemplates(...args),
    listNotebookNotes: (...args: unknown[]) => mockListNotebookNotes(...args),
    getNotebookNote: (...args: unknown[]) => mockGetNotebookNote(...args),
    updateNotebookNote: (...args: unknown[]) => mockUpdateNotebookNote(...args),
    createNotebookNote: (...args: unknown[]) => mockCreateNotebookNote(...args),
    createNotebookFolder: (...args: unknown[]) => mockCreateNotebookFolder(...args),
    createNotebookTag: (...args: unknown[]) => mockCreateNotebookTag(...args),
    createNotebookTemplate: (...args: unknown[]) => mockCreateNotebookTemplate(...args),
    deleteNotebookAttachment: (...args: unknown[]) => mockDeleteNotebookAttachment(...args),
    deleteNotebookFolder: (...args: unknown[]) => mockDeleteNotebookFolder(...args),
    deleteNotebookNote: (...args: unknown[]) => mockDeleteNotebookNote(...args),
    listLosses: (...args: unknown[]) => mockListLosses(...args),
    listNotebookAttachments: (...args: unknown[]) => mockListNotebookAttachments(...args),
    replaceNotebookNoteTags: (...args: unknown[]) => mockReplaceNotebookNoteTags(...args),
    restoreNotebookNote: (...args: unknown[]) => mockRestoreNotebookNote(...args),
    uploadNotebookAttachment: (...args: unknown[]) => mockUploadNotebookAttachment(...args)
  }
})

vi.mock('../components/notebook/NoteMetaSidebar', () => ({
  default: () => <div data-testid="mock-note-meta-sidebar" />
}))

vi.mock('../components/notebook/NoteEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <textarea aria-label="Note content" value={value} onChange={(event) => onChange(event.target.value)} />
  )
}))

const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const minMatch = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)px\)/)
    const maxMatch = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/)
    const min = minMatch ? Number(minMatch[1]) : null
    const max = maxMatch ? Number(maxMatch[1]) : null
    const matches = (min === null || width >= min) && (max === null || width <= max)
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
  }) as unknown as typeof window.matchMedia
}

const renderNotebook = () => {
  const router = createMemoryRouter(
    [
      {
        path: '/notebook',
        element: (
          <I18nProvider>
            <NotebookPage />
          </I18nProvider>
        )
      }
    ],
    { initialEntries: ['/notebook'] }
  )

  return render(<RouterProvider router={router} />)
}

describe('Notebook desktop layout and smoke flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('app.language', 'en')
    setViewportSize(1366, 900)

    notesState = [
      {
        id: 'note-1',
        type: 'NOTE',
        title: 'London open prep',
        body: 'Wait for clean breakouts only.',
        bodyJson: JSON.stringify({ format: 'html', content: '<p>Wait for clean breakouts only.</p>' }),
        isPinned: false,
        hasAttachments: false,
        createdAt: '2026-02-15T06:00:00Z',
        updatedAt: '2026-02-15T06:00:00Z',
        tagIds: []
      },
      {
        id: 'note-2',
        type: 'PLAN',
        title: 'FOMC plan recap',
        body: 'Protect downside risk and avoid chasing.',
        bodyJson: JSON.stringify({ format: 'html', content: '<p>Protect downside risk and avoid chasing.</p>' }),
        isPinned: true,
        hasAttachments: false,
        createdAt: '2026-02-15T07:00:00Z',
        updatedAt: '2026-02-15T07:00:00Z',
        tagIds: []
      }
    ]

    mockListNotebookFolders.mockResolvedValue([
      { id: 'folder-all', name: 'All notes', systemKey: 'ALL_NOTES' },
      { id: 'folder-daily', name: 'Daily journal', systemKey: 'DAILY_JOURNAL' },
      { id: 'folder-custom-1', name: 'Research', systemKey: null }
    ])
    mockListNotebookTags.mockResolvedValue([])
    mockListNotebookTemplates.mockResolvedValue([])
    mockListNotebookNotes.mockImplementation(async () => notesState)
    mockListNotebookAttachments.mockResolvedValue([])
    mockListLosses.mockResolvedValue([])
    mockGetNotebookNote.mockImplementation(async (id: string) => notesState.find((note) => note.id === id) ?? notesState[0])
    mockCreateNotebookNote.mockResolvedValue(notesState[0])
    mockCreateNotebookFolder.mockResolvedValue({ id: 'folder-new', name: 'New folder', systemKey: null })
    mockCreateNotebookTag.mockResolvedValue({ id: 'tag-1', name: 'tag', color: null })
    mockCreateNotebookTemplate.mockResolvedValue({ id: 'template-1', name: 'Template', content: '<p>x</p>' })
    mockDeleteNotebookAttachment.mockResolvedValue(undefined)
    mockDeleteNotebookFolder.mockResolvedValue(undefined)
    mockDeleteNotebookNote.mockResolvedValue(undefined)
    mockReplaceNotebookNoteTags.mockResolvedValue(notesState[0])
    mockRestoreNotebookNote.mockResolvedValue(notesState[0])
    mockUploadNotebookAttachment.mockResolvedValue({
      id: 'asset-1',
      noteId: 'note-1',
      fileName: 'file.txt'
    })
    mockUpdateNotebookNote.mockImplementation(async (id: string, payload: Record<string, unknown>) => {
      const current = notesState.find((item) => item.id === id)
      const next = {
        ...current,
        ...payload,
        id,
        tagIds: current?.tagIds || [],
        updatedAt: '2026-02-15T08:00:00Z'
      }
      notesState = notesState.map((item) => (item.id === id ? next : item))
      return next
    })
  })

  it('uses top horizontal navigation and a 2-column desktop layout with editor min width guard', async () => {
    renderNotebook()

    const topNav = await screen.findByTestId('notebook-top-nav')
    const desktopLayout = screen.getByTestId('notebook-layout-desktop')
    const listPane = screen.getByTestId('notebook-list-pane')
    const editorPane = screen.getByTestId('notebook-editor-pane')

    expect(topNav).toBeInTheDocument()
    expect(desktopLayout).toBeInTheDocument()
    expect(listPane).toBeInTheDocument()
    expect(editorPane).toBeInTheDocument()
    expect(Number(editorPane.getAttribute('data-editor-min-width'))).toBeGreaterThanOrEqual(640)
  })

  it('smoke: opens a note, enters edit mode, and exposes save action', async () => {
    const user = userEvent.setup()
    renderNotebook()

    const noteButton = await screen.findByRole('button', { name: /FOMC plan recap/i })
    await user.click(noteButton)
    await waitFor(() => {
      expect(mockGetNotebookNote).toHaveBeenCalledWith('note-2')
    })

    await user.click(screen.getByRole('button', { name: 'Edit mode' }))
    const pinIcon = await screen.findByTestId('StarIcon')
    const pinButton = pinIcon.closest('button')
    if (!pinButton) {
      throw new Error('Expected pin toggle button')
    }
    await user.click(pinButton)

    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeInTheDocument()
    fireEvent.click(saveButton)
  })
})
