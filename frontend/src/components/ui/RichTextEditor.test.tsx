import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import RichTextEditor from './RichTextEditor'

const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
  vi.restoreAllMocks()
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand)
  else Reflect.deleteProperty(document, 'execCommand')
})

function ControlledEditor({ onChange = vi.fn() }: { onChange?: (html: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <I18nProvider>
      <RichTextEditor
        ariaLabel="Research notes"
        value={value}
        onChange={(html) => {
          onChange(html)
          setValue(html)
        }}
      />
    </I18nProvider>
  )
}

function selectText(node: Node, start: number, end = start) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

describe('rich text editing', () => {
  it('keeps the caret and text nodes when browser formatting is sanitized during typing', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)
    const editor = screen.getByRole('textbox', { name: 'Research notes' })
    // Chrome can add inline styles when editing or pasting formatted content.
    editor.innerHTML = '<p>EMA <span style="font-weight: 400;">20 rising</span></p>'
    const text = editor.querySelector('span')!.firstChild!
    editor.focus()
    const selection = selectText(text, 3)

    fireEvent.input(editor)

    expect(onChange).toHaveBeenLastCalledWith('<p>EMA <span>20 rising</span></p>')
    expect(editor.innerHTML).toBe('<p>EMA <span>20 rising</span></p>')
    expect(selection.anchorNode).toBe(text)
    expect(selection.anchorOffset).toBe(3)
    expect(editor).toHaveFocus()

    // A subsequent keystroke must still be inserted at the current caret.
    selection.getRangeAt(0).insertNode(document.createTextNode('still '))
    fireEvent.input(editor)
    expect(editor).toHaveTextContent('EMA 20 still rising')
  })

  it('preserves a selection in formatted text when the parent echoes the sanitized value', () => {
    render(<ControlledEditor />)
    const editor = screen.getByRole('textbox', { name: 'Research notes' })
    editor.innerHTML = '<p><strong style="font-weight: bold;">Bullish structure</strong></p>'
    const text = editor.querySelector('strong')!.firstChild!
    const selection = selectText(text, 0, 7)

    fireEvent.input(editor)

    expect(selection.anchorNode).toBe(text)
    expect(selection.anchorOffset).toBe(0)
    expect(selection.focusNode).toBe(text)
    expect(selection.focusOffset).toBe(7)
  })

  it('sanitizes toolbar changes without replacing the edited text nodes', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)
    const editor = screen.getByRole('textbox', { name: 'Research notes' })
    let text: Node
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => {
        editor.innerHTML = '<h1 style="font-weight: bold;">Market context</h1>'
        text = editor.querySelector('h1')!.firstChild!
        selectText(text, 6)
        return true
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Heading 1' }))

    expect(onChange).toHaveBeenLastCalledWith('<h1>Market context</h1>')
    expect(editor.innerHTML).toBe('<h1>Market context</h1>')
    expect(window.getSelection()!.anchorNode).toBe(text!)
    expect(window.getSelection()!.anchorOffset).toBe(6)
  })

  it('removes unsafe attributes and unsupported elements from both live and emitted content', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)
    const editor = screen.getByRole('textbox', { name: 'Research notes' })
    editor.innerHTML = '<p onclick="alert(1)"><a href="javascript:alert(1)">Link</a><img src="x" onerror="alert(1)"><font color="red">Text</font></p>'

    fireEvent.input(editor)

    const sanitized = '<p><a rel="noopener noreferrer" target="_blank">Link</a>Text</p>'
    expect(editor.innerHTML).toBe(sanitized)
    expect(onChange).toHaveBeenLastCalledWith(sanitized)
  })

  it('keeps the caret in text when an unsupported formatting wrapper is removed', () => {
    render(<ControlledEditor />)
    const editor = screen.getByRole('textbox', { name: 'Research notes' })
    editor.innerHTML = '<p>EMA <font color="red">20 rising</font></p>'
    const text = editor.querySelector('font')!.firstChild!
    const selection = selectText(text, 3)

    fireEvent.input(editor)

    expect(editor.innerHTML).toBe('<p>EMA 20 rising</p>')
    expect(selection.anchorNode).toBe(text)
    expect(selection.anchorOffset).toBe(3)
  })

  it('loads external changes and clears while focused, with sanitized HTML', () => {
    const onChange = vi.fn()
    const view = (value: string) => (
      <I18nProvider>
        <RichTextEditor ariaLabel="Research notes" value={value} onChange={onChange} />
      </I18nProvider>
    )
    const { rerender } = render(view('<p>Original</p>'))
    const editor = screen.getByRole('textbox', { name: 'Research notes' })
    expect(editor.innerHTML).toBe('<p>Original</p>')
    editor.focus()

    rerender(view('<h2 onclick="alert(1)">Restored version</h2>'))
    expect(editor.innerHTML).toBe('<h2>Restored version</h2>')
    rerender(view(''))
    expect(editor.innerHTML).toBe('')
    expect(onChange).not.toHaveBeenCalled()
  })
})
