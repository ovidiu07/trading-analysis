import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import LinkIcon from '@mui/icons-material/Link'
import type { NotebookAttachment, NotebookFolder, NotebookNote, NotebookTag, NotebookTemplate } from '../../api/notebook'
import type { TradeResponse } from '../../api/trades'
import { useI18n } from '../../i18n'
import { formatCurrency, formatDateTime } from '../../utils/format'
import AssetListRenderer, { type UploadQueueItem } from '../assets/AssetListRenderer'
import AssetUploadDropzone from '../assets/AssetUploadDropzone'

type NoteMetaSidebarProps = {
  note: NotebookNote
  readOnly: boolean
  timezone: string
  baseCurrency: string
  folders: NotebookFolder[]
  tags: NotebookTag[]
  noteTags: NotebookTag[]
  onUpdateNote: (patch: Partial<NotebookNote>) => void
  onUpdateTags: (value: NotebookTag[]) => void
  tradeDetail: TradeResponse | null
  tradeSearchQuery: string
  tradeSearchResults: TradeResponse[]
  tradeSearchLoading: boolean
  onTradeSearchQueryChange: (value: string) => void
  onLinkTrade: (trade: TradeResponse | null) => void
  onUnlinkTrade: () => void
  templates: NotebookTemplate[]
  templateSelection: string
  onTemplateSelectionChange: (id: string) => void
  onApplyTemplate: () => void
  onSaveTemplate: () => void
  onInsertDailyTemplate: () => void
  attachments: NotebookAttachment[]
  uploads: UploadQueueItem[]
  onUploadAttachments: (files: File[]) => void
  onDownloadAttachment: (attachment: NotebookAttachment) => void
  onDeleteAttachment: (id: string) => void
  saving: boolean
}

const renderTradeLabel = (trade: TradeResponse, timezone: string) => {
  const side = trade.direction === 'LONG' ? 'L' : 'S'
  const opened = trade.openedAt ? formatDateTime(trade.openedAt, timezone) : '--'
  return `${trade.symbol} • ${side} • ${opened}`
}

export default function NoteMetaSidebar({
  note,
  readOnly,
  timezone,
  baseCurrency,
  folders,
  tags,
  noteTags,
  onUpdateNote,
  onUpdateTags,
  tradeDetail,
  tradeSearchQuery,
  tradeSearchResults,
  tradeSearchLoading,
  onTradeSearchQueryChange,
  onLinkTrade,
  onUnlinkTrade,
  templates,
  templateSelection,
  onTemplateSelectionChange,
  onApplyTemplate,
  onSaveTemplate,
  onInsertDailyTemplate,
  attachments,
  uploads,
  onUploadAttachments,
  onDownloadAttachment,
  onDeleteAttachment,
  saving
}: NoteMetaSidebarProps) {
  const { t } = useI18n()

  return (
    <Stack
      spacing={1}
      sx={{
        borderLeft: '1px solid',
        borderColor: 'divider',
        minHeight: 0,
        height: '100%',
        overflowY: 'auto',
        p: 1,
        pb: 2
      }}
    >
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
          <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sidebar.tradeLink')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <Autocomplete
              size="small"
              options={tradeSearchResults}
              value={null}
              loading={tradeSearchLoading}
              disabled={readOnly}
              inputValue={tradeSearchQuery}
              onInputChange={(_, value) => onTradeSearchQueryChange(value)}
              onChange={(_, value) => onLinkTrade(value)}
              getOptionLabel={(option) => renderTradeLabel(option, timezone)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('notebook.fields.linkTrade')}
                  placeholder={t('notebook.placeholders.searchTrade')}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {tradeSearchLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
                />
              )}
            />

            {tradeDetail && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Chip label={tradeDetail.symbol} size="small" />
                      <Chip label={t(`trades.direction.${tradeDetail.direction}`)} size="small" variant="outlined" />
                      <Chip label={t(`trades.status.${tradeDetail.status}`)} size="small" variant="outlined" />
                    </Stack>
                    {!readOnly && (
                      <Button size="small" color="error" startIcon={<LinkOffIcon />} onClick={onUnlinkTrade}>
                        {t('notebook.actions.unlinkTrade')}
                      </Button>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('notebook.tradeSummary.openedAt', { date: formatDateTime(tradeDetail.openedAt, timezone) })}
                  </Typography>
                  {tradeDetail.closedAt && (
                    <Typography variant="caption" color="text.secondary">
                      {t('notebook.tradeSummary.closedAt', { date: formatDateTime(tradeDetail.closedAt, timezone) })}
                    </Typography>
                  )}
                  <Typography variant="body2" fontWeight={700}>
                    {formatCurrency(tradeDetail.pnlNet ?? 0, baseCurrency)}
                  </Typography>
                </Stack>
              </Box>
            )}

            {!tradeDetail && note.relatedTradeId && (
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">{t('notebook.labels.tradeLinked')}</Typography>
              </Stack>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
          <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sidebar.tagsAndFolder')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <TextField
              select
              size="small"
              label={t('notebook.fields.type')}
              value={note.type}
              onChange={(event) => onUpdateNote({ type: event.target.value as NotebookNote['type'] })}
              disabled={readOnly}
            >
              <MenuItem value="DAILY_LOG">{t('notebook.noteType.DAILY_LOG')}</MenuItem>
              <MenuItem value="TRADE_NOTE">{t('notebook.noteType.TRADE_NOTE')}</MenuItem>
              <MenuItem value="PLAN">{t('notebook.noteType.PLAN')}</MenuItem>
              <MenuItem value="GOAL">{t('notebook.noteType.GOAL')}</MenuItem>
              <MenuItem value="SESSION_RECAP">{t('notebook.noteType.SESSION_RECAP')}</MenuItem>
              <MenuItem value="NOTE">{t('notebook.noteType.NOTE')}</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label={t('notebook.fields.folder')}
              value={note.folderId ?? ''}
              onChange={(event) => onUpdateNote({ folderId: event.target.value || null })}
              disabled={readOnly}
            >
              <MenuItem value="">{t('notebook.labels.noFolder')}</MenuItem>
              {folders.filter((folder) => !folder.systemKey).map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>{folder.name}</MenuItem>
              ))}
            </TextField>

            <Autocomplete
              multiple
              options={tags}
              value={noteTags}
              onChange={(_, value) => onUpdateTags(value)}
              disabled={readOnly}
              getOptionLabel={(option) => option.name}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip label={option.name} {...getTagProps({ index })} key={option.id} size="small" />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} size="small" label={t('notebook.fields.tags')} placeholder={t('notebook.fields.tags')} />
              )}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
          <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sections.attachments')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <AssetUploadDropzone
              title={t('notebook.upload.dropTitle')}
              hint={t('notebook.upload.dropHint')}
              buttonLabel={t('notebook.actions.uploadAttachment')}
              onFilesSelected={onUploadAttachments}
              disabled={readOnly || saving}
              multiple
            />
            <AssetListRenderer
              assets={attachments.map((item) => ({
                id: item.id,
                scope: 'NOTEBOOK',
                noteId: item.noteId,
                originalFileName: item.fileName,
                contentType: item.mimeType,
                sizeBytes: item.sizeBytes,
                url: item.url,
                downloadUrl: item.downloadUrl,
                viewUrl: item.viewUrl,
                thumbnailUrl: item.thumbnailUrl,
                image: item.image,
                createdAt: item.createdAt
              }))}
              uploads={uploads}
              emptyText={t('notebook.empty.noAttachments')}
              onDownload={(item) => onDownloadAttachment({
                id: item.id,
                noteId: item.noteId || '',
                fileName: item.originalFileName,
                mimeType: item.contentType || undefined,
                sizeBytes: item.sizeBytes ?? undefined,
                url: item.url || undefined,
                downloadUrl: item.downloadUrl || undefined,
                viewUrl: item.viewUrl || undefined,
                thumbnailUrl: item.thumbnailUrl || undefined,
                image: item.image,
                createdAt: item.createdAt || undefined
              })}
              onRemove={readOnly ? undefined : (item) => onDeleteAttachment(item.id)}
              downloadLabel={t('common.download')}
              removeLabel={t('common.delete')}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
          <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sidebar.templates')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <TextField
              select
              size="small"
              label={t('notebook.fields.applyTemplate')}
              value={templateSelection}
              onChange={(event) => onTemplateSelectionChange(event.target.value)}
              disabled={readOnly}
            >
              <MenuItem value="">{t('common.none')}</MenuItem>
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" onClick={onApplyTemplate} disabled={readOnly || !templateSelection}>{t('common.apply')}</Button>
              <Button size="small" variant="text" onClick={onSaveTemplate} disabled={readOnly}>{t('notebook.actions.saveAsTemplate')}</Button>
            </Stack>
            {note.type === 'DAILY_LOG' && (
              <Button size="small" variant="text" onClick={onInsertDailyTemplate} disabled={readOnly}>
                {t('notebook.actions.insertDailyLogStructure')}
              </Button>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters defaultExpanded={note.type === 'DAILY_LOG'}>
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
          <Typography variant="subtitle2" fontWeight={700}>{t('notebook.sidebar.date')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <TextField
              size="small"
              required={note.type === 'DAILY_LOG'}
              label={t('notebook.fields.date')}
              type="date"
              InputLabelProps={{ shrink: true }}
              value={note.dateKey ?? ''}
              disabled={readOnly}
              onChange={(event) => onUpdateNote({ dateKey: event.target.value })}
              error={note.type === 'DAILY_LOG' && (!note.dateKey || !note.dateKey.trim())}
              helperText={note.type === 'DAILY_LOG' && (!note.dateKey || !note.dateKey.trim()) ? t('notebook.validation.dateRequired') : ' '}
            />
          </Stack>
          <Divider sx={{ mt: 0.5 }} />
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}
