import { Box, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import CodeIcon from '@mui/icons-material/Code'
import DataObjectIcon from '@mui/icons-material/DataObject'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import LinkIcon from '@mui/icons-material/Link'
import { useCallback, useEffect, useRef } from 'react'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  placeholder?: string
}

const sanitizeHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowedTags = new Set([
    'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
    'PRE', 'CODE', 'H1', 'H2', 'H3', 'HR', 'A', 'SPAN', 'DIV', 'LABEL', 'INPUT'
  ])
  const allowedAttrs: Record<string, string[]> = {
    A: ['href', 'target', 'rel'],
    INPUT: ['type', 'checked', 'disabled'],
    LI: ['data-type'],
    UL: ['data-type'],
    LABEL: ['data-type']
  }

  Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
    if (!allowedTags.has(el.tagName)) {
      const parent = el.parentNode
      if (!parent) return
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el)
      }
      parent.removeChild(el)
      return
    }
    Array.from(el.attributes).forEach((attr) => {
      const allowed = allowedAttrs[el.tagName]?.includes(attr.name) || attr.name.startsWith('data-')
      if (!allowed) {
        el.removeAttribute(attr.name)
      }
    })
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || ''
      if (href.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('href')
      }
      el.setAttribute('rel', 'noopener noreferrer')
      el.setAttribute('target', '_blank')
    }
  })
  return doc.body.innerHTML
}

export default function RichTextEditor({ value, onChange, readOnly = false, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    const sanitized = sanitizeHtml(value)
    if (editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized || ''
    }
  }, [value])

  const exec = useCallback((command: string, valueArg?: string) => {
    if (readOnly) return
    document.execCommand(command, false, valueArg)
    if (editorRef.current) {
      onChange(sanitizeHtml(editorRef.current.innerHTML))
    }
  }, [onChange, readOnly])

  const handleChecklist = () => {
    if (readOnly) return
    exec('insertHTML', '<ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox" /></label><span></span></li></ul>')
  }

  const handleCodeBlock = () => {
    if (readOnly) return
    exec('formatBlock', 'pre')
  }

  const handleHeading = (level: number) => {
    if (readOnly) return
    exec('formatBlock', `h${level}`)
  }

  const handleLink = () => {
    if (readOnly) return
    const url = window.prompt('Enter URL', 'https://')
    if (!url) return
    exec('createLink', url)
  }

  const handleInput = () => {
    if (!editorRef.current) return
    onChange(sanitizeHtml(editorRef.current.innerHTML))
  }

  return (
    <Stack spacing={1}>
      {!readOnly && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 0.5
          }}
        >
          <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center">
            {[1, 2, 3].map((level) => (
              <Tooltip key={level} title={`Heading ${level}`}>
                <IconButton size="small" onClick={() => handleHeading(level)} aria-label={`Heading ${level}`}>
                  <Typography variant="caption" fontWeight={700}>H{level}</Typography>
                </IconButton>
              </Tooltip>
            ))}
            <Tooltip title="Bold">
              <IconButton size="small" onClick={() => exec('bold')}>
                <FormatBoldIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton size="small" onClick={() => exec('italic')}>
                <FormatItalicIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Underline">
              <IconButton size="small" onClick={() => exec('underline')}>
                <FormatUnderlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider flexItem orientation="vertical" />
            <Tooltip title="Bullet list">
              <IconButton size="small" onClick={() => exec('insertUnorderedList')}>
                <FormatListBulletedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Numbered list">
              <IconButton size="small" onClick={() => exec('insertOrderedList')}>
                <FormatListNumberedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Checklist">
              <IconButton size="small" onClick={handleChecklist}>
                <CheckBoxOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider flexItem orientation="vertical" />
            <Tooltip title="Blockquote">
              <IconButton size="small" onClick={() => exec('formatBlock', 'blockquote')}>
                <FormatQuoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Inline code">
              <IconButton size="small" onClick={() => exec('insertHTML', '<code></code>')}>
                <CodeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Code block">
              <IconButton size="small" onClick={handleCodeBlock}>
                <DataObjectIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Horizontal rule">
              <IconButton size="small" onClick={() => exec('insertHorizontalRule')}>
                <HorizontalRuleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Link">
              <IconButton size="small" onClick={handleLink}>
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider flexItem orientation="vertical" />
            <Tooltip title="Undo">
              <IconButton size="small" onClick={() => exec('undo')}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo">
              <IconButton size="small" onClick={() => exec('redo')}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}
      <Box
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder || 'Start writing your note…'}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 2,
          minHeight: 260,
          backgroundColor: readOnly ? 'background.default' : 'background.paper',
          '& h1': {
            fontSize: '1.6rem',
            fontWeight: 700,
            marginTop: 0
          },
          '& h2': {
            fontSize: '1.3rem',
            fontWeight: 700,
            marginTop: '1rem'
          },
          '& h3': {
            fontSize: '1.1rem',
            fontWeight: 700,
            marginTop: '1rem'
          },
          '& blockquote': {
            borderLeft: '3px solid',
            borderColor: 'divider',
            marginLeft: 0,
            paddingLeft: '0.75rem',
            color: 'text.secondary'
          },
          '& pre': {
            backgroundColor: 'rgba(15, 23, 42, 0.08)',
            padding: '0.75rem',
            borderRadius: 8,
            overflowX: 'auto'
          },
          '&:empty:before': {
            content: 'attr(data-placeholder)',
            color: 'text.secondary'
          }
        }}
      />
    </Stack>
  )
}
