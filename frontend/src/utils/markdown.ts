const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const applyInlineMarkdown = (value: string) => value
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')

export const convertMarkdownToHtml = (markdown: string) => {
  if (!markdown) return ''
  const lines = markdown.split(/\r?\n/)
  let html = ''
  let listMode: 'ul' | 'ol' | 'task' | null = null
  let inCodeBlock = false

  const closeList = () => {
    if (listMode === 'ul') html += '</ul>'
    if (listMode === 'ol') html += '</ol>'
    if (listMode === 'task') html += '</ul>'
    listMode = null
  }

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      html += '</code></pre>'
      inCodeBlock = false
    }
  }

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim()

    if (trimmed.startsWith('```')) {
      closeList()
      if (!inCodeBlock) {
        html += '<pre><code>'
        inCodeBlock = true
      } else {
        closeCodeBlock()
      }
      return
    }

    if (inCodeBlock) {
      html += `${escapeHtml(rawLine)}\n`
      return
    }

    if (!trimmed) {
      closeList()
      return
    }

    if (/^---+$/.test(trimmed)) {
      closeList()
      html += '<hr />'
      return
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      html += `<h${level}>${applyInlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`
      return
    }

    if (trimmed.startsWith('> ')) {
      closeList()
      html += `<blockquote>${applyInlineMarkdown(escapeHtml(trimmed.slice(2)))}</blockquote>`
      return
    }

    const taskMatch = trimmed.match(/^- \[( |x|X)]\s+(.*)$/)
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

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      if (listMode !== 'ul') {
        closeList()
        html += '<ul>'
        listMode = 'ul'
      }
      html += `<li>${applyInlineMarkdown(escapeHtml(bulletMatch[1]))}</li>`
      return
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
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
    html += `<p>${applyInlineMarkdown(escapeHtml(trimmed))}</p>`
  })

  closeList()
  closeCodeBlock()
  return html
}
