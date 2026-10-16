import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import RichTextEditor from '../../components/ui/RichTextEditor'
import SecureAssetImage from '../../components/assets/SecureAssetImage'
import type { AssetItem } from '../../api/assets'
import { ItemActions } from './controls'
import { move, newBlock, uid, type Block, type BlockType } from './model'
import { useStudioText } from './labels'
const blockTypes: [BlockType, string][] = [
  ['TEXT', 'Text'],
  ['HEADING', 'Heading'],
  ['BULLET', 'Bullet list'],
  ['NUMBERED', 'Numbered list'],
  ['CHECKLIST', 'Checklist'],
  ['TABLE', 'Table'],
  ['QUOTE', 'Quote'],
  ['CALLOUT', 'Callout'],
  ['DIVIDER', 'Divider'],
  ['IMAGE', 'Image'],
  ['CODE', 'Code']
]
export default function Notebook({
  blocks,
  onChange,
  assets,
  onUpload,
  uploading
}: {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  assets: AssetItem[]
  onUpload: (files: File[], blockId?: string) => Promise<void>
  uploading: boolean
}) {
  const s = useStudioText(),
    [menu, setMenu] = useState<HTMLElement | null>(null),
    [active, setActive] = useState<string>('')
  const patch = (id: string, data: Partial<Block>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...data } : b)))
  const insert = (type: BlockType) => {
    const block = newBlock(type)
    onChange([...blocks, block])
    setActive(block.id)
    setMenu(null)
  }
  const dropFiles = (files: File[]) => {
    if (files.length) void onUpload(files).catch(() => {})
  }
  return (
    <Stack
      spacing={2}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files).filter((f) => f.type.startsWith('image/'))
        if (files.length) {
          event.preventDefault()
          dropFiles(files)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault()
          dropFiles(Array.from(event.dataTransfer.files))
        }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="h6">{s('Notebook')}</Typography>
        <Button variant="outlined" onClick={(e) => setMenu(e.currentTarget)}>
          {s('Add block')}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {s(
          'Document your setup, paste chart screenshots, or type / inside a block to insert content. Drag a handle to reorder; arrow controls also work on mobile.'
        )}
      </Typography>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {blockTypes.map(([type, label]) => (
          <MenuItem key={type} onClick={() => insert(type)}>
            {s(label)}
          </MenuItem>
        ))}
      </Menu>
      {!blocks.length && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {s('Start with a hypothesis, an example, or a chart screenshot.')}
          </Typography>
          <Button onClick={() => insert('TEXT')}>{s('Add block')}</Button>
        </Paper>
      )}
      {blocks.map((block, index) => {
        const asset = assets.find((a) => a.id === block.assetId)
        return (
          <Paper
            key={block.id}
            variant="outlined"
            data-testid="notebook-block"
            onFocusCapture={() => setActive(block.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('application/x-strategy-block')
              if (!id) return
              e.preventDefault()
              e.stopPropagation()
              const source = blocks.findIndex((b) => b.id === id)
              if (source < 0) return
              const reordered = [...blocks]
              const [picked] = reordered.splice(source, 1)
              reordered.splice(index, 0, picked)
              onChange(reordered)
            }}
            sx={{
              p: { xs: 1, sm: 1.5 },
              borderColor: active === block.id ? 'primary.main' : 'divider',
              bgcolor: block.type === 'CALLOUT' ? 'action.hover' : 'background.paper'
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
              <Stack direction="row" alignItems="center">
                <IconButton
                  aria-label={s('Drag block')}
                  size="small"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-strategy-block', block.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  sx={{ cursor: 'grab' }}
                >
                  <DragIndicatorRounded fontSize="small" />
                </IconButton>
                <Chip
                  size="small"
                  variant="outlined"
                  label={s(blockTypes.find(([t]) => t === block.type)?.[1] || block.type)}
                />
                <IconButton
                  size="small"
                  aria-label={s(block.collapsed ? 'Expand' : 'Collapse')}
                  onClick={() => patch(block.id, { collapsed: !block.collapsed })}
                >
                  <ExpandMoreRounded sx={{ transform: block.collapsed ? 'rotate(-90deg)' : undefined }} />
                </IconButton>
              </Stack>
              <ItemActions
                index={index}
                count={blocks.length}
                onMove={(n) => onChange(move(blocks, index, n))}
                onDuplicate={() =>
                  onChange([
                    ...blocks.slice(0, index + 1),
                    { ...structuredClone(block), id: uid() },
                    ...blocks.slice(index + 1)
                  ])
                }
                onDelete={() => onChange(blocks.filter((b) => b.id !== block.id))}
              />
            </Stack>
            {!block.collapsed && (
              <Box
                sx={{ mt: 1 }}
                onKeyDown={(e) => {
                  if (e.key === '/' && !(e.target as HTMLElement).textContent?.trim()) {
                    e.preventDefault()
                    setMenu(e.currentTarget)
                  }
                }}
              >
                {block.type === 'DIVIDER' ? (
                  <Divider sx={{ my: 2 }} />
                ) : block.type === 'IMAGE' ? (
                  <Stack spacing={1}>
                    {asset ? (
                      <SecureAssetImage
                        url={asset.viewUrl || asset.url}
                        alt={block.caption || asset.originalFileName}
                        sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 1 }}
                      />
                    ) : (
                      <Alert severity="info">{s('Upload a chart screenshot or select an attached image.')}</Alert>
                    )}
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                      <Button component="label" disabled={uploading}>
                        {s('Upload image')}
                        <input
                          hidden
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void onUpload([file], block.id).catch(() => {})
                            e.target.value = ''
                          }}
                        />
                      </Button>
                      <TextField
                        size="small"
                        select
                        fullWidth
                        label={s('Image')}
                        value={block.assetId || ''}
                        onChange={(e) => patch(block.id, { assetId: e.target.value || undefined })}
                      >
                        <MenuItem value="">{s('Unspecified')}</MenuItem>
                        {assets
                          .filter((a) => a.image)
                          .map((a) => (
                            <MenuItem key={a.id} value={a.id}>
                              {a.originalFileName}
                            </MenuItem>
                          ))}
                      </TextField>
                    </Stack>
                    <TextField
                      size="small"
                      label={s('Caption')}
                      value={block.caption || ''}
                      onChange={(e) => patch(block.id, { caption: e.target.value })}
                    />
                  </Stack>
                ) : block.type === 'TABLE' ? (
                  <Stack spacing={1}>
                    <Box sx={{ overflowX: 'auto' }}>
                      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {(block.rows || []).map((row, r) => (
                            <tr key={r}>
                              {row.map((cell, c) => (
                                <Box component="td" key={c} sx={{ minWidth: 140, p: 0.25 }}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    inputProps={{ 'aria-label': `${s('Table')} ${r + 1}, ${c + 1}`, maxLength: 4000 }}
                                    value={cell}
                                    onChange={(e) =>
                                      patch(block.id, {
                                        rows: block.rows!.map((x, i) =>
                                          i === r ? x.map((v, j) => (j === c ? e.target.value : v)) : x
                                        )
                                      })
                                    }
                                  />
                                </Box>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </Box>
                    </Box>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      <Button
                        size="small"
                        disabled={(block.rows?.length || 0) >= 100}
                        onClick={() =>
                          patch(block.id, {
                            rows: [...(block.rows || []), Array(block.rows?.[0]?.length || 2).fill('')]
                          })
                        }
                      >
                        {s('Add row')}
                      </Button>
                      <Button
                        size="small"
                        disabled={(block.rows?.[0]?.length || 0) >= 20}
                        onClick={() => patch(block.id, { rows: block.rows!.map((r) => [...r, '']) })}
                      >
                        {s('Add column')}
                      </Button>
                      <Button
                        size="small"
                        disabled={(block.rows?.length || 0) <= 1}
                        onClick={() => patch(block.id, { rows: block.rows!.slice(0, -1) })}
                      >
                        {s('Remove last row')}
                      </Button>
                      <Button
                        size="small"
                        disabled={(block.rows?.[0]?.length || 0) <= 1}
                        onClick={() => patch(block.id, { rows: block.rows!.map((r) => r.slice(0, -1)) })}
                      >
                        {s('Remove last column')}
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    {block.type === 'CHECKLIST' && (
                      <Checkbox
                        checked={Boolean(block.checked)}
                        inputProps={{ 'aria-label': s('Checklist') }}
                        onChange={(_, checked) => patch(block.id, { checked })}
                      />
                    )}
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        ...(block.type === 'HEADING'
                          ? { '& [contenteditable]': { fontSize: '1.5rem', fontWeight: 750 } }
                          : block.type === 'CODE'
                            ? { '& [contenteditable]': { fontFamily: 'monospace', bgcolor: 'action.hover' } }
                            : {}),
                        ...(block.type === 'QUOTE' ? { borderLeft: 3, borderColor: 'primary.main', pl: 1 } : {})
                      }}
                    >
                      <RichTextEditor
                        allowHighlight
                        value={block.html || ''}
                        onChange={(html) => patch(block.id, { html })}
                        compactToolbar
                        hideToolbar={active !== block.id}
                        minHeight={block.type === 'HEADING' ? 64 : 100}
                        ariaLabel={`${s('Notebook')} ${index + 1}`}
                      />
                    </Box>
                  </Stack>
                )}
              </Box>
            )}
          </Paper>
        )
      })}
      <Box>
        <Button variant="outlined" onClick={(e) => setMenu(e.currentTarget)}>
          {s('Add block')}
        </Button>
        <Button component="label" disabled={uploading}>
          {uploading ? s('Uploading…') : s('Upload image')}
          <input
            hidden
            multiple
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              dropFiles(Array.from(e.target.files || []))
              e.target.value = ''
            }}
          />
        </Button>
      </Box>
    </Stack>
  )
}
