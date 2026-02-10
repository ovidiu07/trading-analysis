import { NotebookNote } from '../../api/notebook'

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

export const convertMarkdownToHtml = (markdown: string) => {
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

export const resolveNoteHtml = (note: NotebookNote | null) => {
  if (!note) return ''
  if (note.bodyJson && note.bodyJson.trim()) {
    try {
      const parsed = JSON.parse(note.bodyJson)
      if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
        return parsed.content
      }
      if (typeof parsed === 'string' && parsed.trim()) {
        return looksLikeHtml(parsed) ? parsed : convertMarkdownToHtml(parsed)
      }
    } catch {
      if (looksLikeHtml(note.bodyJson)) {
        return note.bodyJson
      }
      return convertMarkdownToHtml(note.bodyJson)
    }
  }
  if (note.body && note.body.trim()) {
    return looksLikeHtml(note.body) ? note.body : convertMarkdownToHtml(note.body)
  }
  return ''
}

export const extractPlainText = (html: string) => {
  if (typeof window === 'undefined') return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.body.textContent ?? ''
}

export const buildNoteFingerprint = (note: NotebookNote | null) => {
  if (!note) return ''
  return JSON.stringify({
    title: note.title ?? '',
    body: note.body ?? '',
    bodyJson: note.bodyJson ?? '',
    dateKey: note.dateKey ?? '',
    folderId: note.folderId ?? '',
    type: note.type ?? '',
    relatedTradeId: note.relatedTradeId ?? '',
    isPinned: note.isPinned ?? false,
    reviewJson: note.reviewJson ?? ''
  })
}

const SYMBOL_BLACKLIST = new Set([
  'THE', 'AND', 'FOR', 'WITH', 'THIS', 'THAT', 'PLAN', 'NOTE', 'LOSS', 'GAIN', 'LONG', 'SHORT', 'OPEN', 'CLOSE', 'PNL', 'USD'
])

export const extractSymbolsFromNote = (note: NotebookNote) => {
  const source = `${note.title ?? ''} ${note.body ?? ''}`.toUpperCase()
  const matches = source.match(/\b[A-Z]{2,6}\b/g) || []
  const unique = Array.from(new Set(matches.filter((token) => !SYMBOL_BLACKLIST.has(token))))
  return unique.slice(0, 3)
}
