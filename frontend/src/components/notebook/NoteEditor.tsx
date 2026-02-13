import RichTextEditor from '../ui/RichTextEditor'

type NoteEditorProps = {
  value: string
  compactToolbar?: boolean
  onChange: (nextHtml: string) => void
}

export default function NoteEditor({ value, compactToolbar = false, onChange }: NoteEditorProps) {
  return (
    <RichTextEditor
      value={value}
      readOnly={false}
      compactToolbar={compactToolbar}
      onChange={onChange}
    />
  )
}
