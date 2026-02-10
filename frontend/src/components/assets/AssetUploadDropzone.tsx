import { useRef, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'

type AssetUploadDropzoneProps = {
  title: string
  hint?: string
  buttonLabel: string
  disabled?: boolean
  multiple?: boolean
  accept?: string
  onFilesSelected: (files: File[]) => void
}

export default function AssetUploadDropzone({
  title,
  hint,
  buttonLabel,
  disabled = false,
  multiple = true,
  accept,
  onFilesSelected
}: AssetUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = (files?: FileList | null) => {
    if (!files || files.length === 0 || disabled) return
    onFilesSelected(Array.from(files))
  }

  return (
    <Box
      onDragEnter={(event) => {
        event.preventDefault()
        if (!disabled) setDragActive(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        setDragActive(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        handleFiles(event.dataTransfer?.files)
      }}
      sx={{
        border: '1px dashed',
        borderColor: dragActive ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 2,
        backgroundColor: dragActive ? 'action.hover' : 'background.default',
        transition: 'border-color 120ms ease, background-color 120ms ease'
      }}
    >
      <Stack spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }} textAlign={{ xs: 'left', sm: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', sm: 'center' }}>
          <CloudUploadOutlinedIcon fontSize="small" color={dragActive ? 'primary' : 'action'} />
          <Typography variant="subtitle2">{title}</Typography>
        </Stack>
        {hint && (
          <Typography variant="body2" color="text.secondary">{hint}</Typography>
        )}
        <Button
          variant="outlined"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, minHeight: 40 }}
        >
          {buttonLabel}
        </Button>
      </Stack>
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </Box>
  )
}
