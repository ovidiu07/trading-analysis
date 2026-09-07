import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import EmptyState from '../../components/ui/EmptyState'
import ErrorBanner from '../../components/ui/ErrorBanner'
import LoadingState from '../../components/ui/LoadingState'
import { apiPost, ApiError } from '../../api/client'
import {
  ContentPost,
  ContentPostStatus,
  ContentType,
  archiveContent,
  listAdminContent,
  listAdminContentTypes,
  publishContent
} from '../../api/content'
import { DATABASE_RESET_CONFIRMATION, DatabaseResetResponse, resetDatabaseData } from '../../api/maintenance'
import { useAuth } from '../../auth/AuthContext'
import { isSuperAdminUser } from '../../auth/roles'
import { formatDate, formatDateTime } from '../../utils/format'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { translateApiError } from '../../i18n/errorMessages'

const statusOptions: { label: string; value: ContentPostStatus | '' }[] = [
  { label: 'adminContent.statuses.all', value: '' },
  { label: 'adminContent.statuses.draft', value: 'DRAFT' },
  { label: 'adminContent.statuses.published', value: 'PUBLISHED' },
  { label: 'adminContent.statuses.archived', value: 'ARCHIVED' }
]

type ActionState = {
  type: 'publish' | 'archive'
  post: ContentPost
}

export default function AdminContentPage() {
  const { t, language } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isCompact = useMediaQuery('(max-width:560px)')
  const isSuperAdmin = isSuperAdminUser(user)
  const [items, setItems] = useState<ContentPost[]>([])
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(false)
  const [typesLoading, setTypesLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ q: '', contentTypeId: '', status: '' })
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 })
  const [confirmAction, setConfirmAction] = useState<ActionState | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState<DatabaseResetResponse | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })
  const columnVisibilityModel = useMemo(() => ({
    type: !isCompact,
    updatedAt: !isCompact,
    visibleRange: !isCompact
  }), [isCompact])
  const resetReady = resetConfirmation === DATABASE_RESET_CONFIRMATION && resetPassword.trim().length > 0 && !resetLoading
  const deletedRows = useMemo(() => {
    if (!resetResult) return []
    return Object.entries(resetResult.deletedRows)
      .filter(([, count]) => count > 0)
      .sort(([, left], [, right]) => right - left)
  }, [resetResult])

  const loadTypes = async () => {
    setTypesLoading(true)
    try {
      const data = await listAdminContentTypes({ includeInactive: true })
      setContentTypes(data)
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
    } finally {
      setTypesLoading(false)
    }
  }

  const loadContent = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listAdminContent({
        page: paginationModel.page,
        size: paginationModel.pageSize,
        q: filters.q,
        contentTypeId: filters.contentTypeId || undefined,
        status: filters.status ? (filters.status as ContentPostStatus) : undefined
      })
      setItems(data.content)
      setTotalRows(data.totalElements)
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadContent()
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, paginationModel, language])

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction.type === 'publish') {
        await publishContent(confirmAction.post.id)
        setSnackbar({ open: true, message: t('adminContent.messages.published'), severity: 'success' })
      } else {
        await archiveContent(confirmAction.post.id)
        setSnackbar({ open: true, message: t('adminContent.messages.archived'), severity: 'success' })
      }
      setConfirmAction(null)
      loadContent()
    } catch (err) {
      const apiErr = err as ApiError
      setSnackbar({ open: true, message: translateApiError(apiErr, t, 'adminContent.messages.actionFailed'), severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDatabaseReset = async () => {
    setResetLoading(true)
    try {
      const response = await resetDatabaseData({
        confirmation: resetConfirmation,
        preserveUsers: true,
        password: resetPassword
      })
      setResetResult(response)
      setResetDialogOpen(false)
      setResetConfirmation('')
      setResetPassword('')
      setSnackbar({ open: true, message: t('adminContent.maintenance.messages.success'), severity: 'success' })
      loadContent()
    } catch (err) {
      const apiErr = err as ApiError
      setSnackbar({ open: true, message: translateApiError(apiErr, t, 'adminContent.maintenance.messages.failed'), severity: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'title',
      headerName: t('adminContent.table.title'),
      flex: 1.4,
      minWidth: 220,
      renderCell: (params) => {
        const row = params.row as ContentPost
        const roMissing = (row.missingLocales || []).includes('ro')
        return (
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{row.title}</Typography>
              {roMissing && (
                <Typography variant="caption" color="warning.main">
                  {t('adminContent.badges.roMissing')}
                </Typography>
              )}
              {typeof row.contentVersion === 'number' && row.contentVersion > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('adminContent.table.version', { version: row.contentVersion })}
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.summary || t('adminContent.table.noSummary')}
            </Typography>
          </Stack>
        )
      }
    },
    {
      field: 'type',
      headerName: t('adminContent.table.type'),
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.contentTypeDisplayName || params.row.contentTypeKey}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: t('adminContent.table.status'),
      minWidth: 130,
      renderCell: (params) => (
        <Typography variant="body2">{t(`adminContent.statuses.${String(params.row.status).toLowerCase()}`)}</Typography>
      )
    },
    {
      field: 'updatedAt',
      headerName: t('adminContent.table.updated'),
      minWidth: 170,
      renderCell: (params) => (
        <Typography variant="body2">{formatDateTime(params.row.updatedAt)}</Typography>
      )
    },
    {
      field: 'visibleRange',
      headerName: t('adminContent.table.visibleRange'),
      minWidth: 200,
      flex: 1,
      renderCell: (params) => {
        const row = params.row as ContentPost
        if (row.contentTypeKey === 'WEEKLY_PLAN' && row.weekStart && row.weekEnd) {
          return (
            <Typography variant="body2">
              {formatDate(row.weekStart)} – {formatDate(row.weekEnd)}
            </Typography>
          )
        }
        if (row.visibleFrom || row.visibleUntil) {
          return (
            <Typography variant="body2">
              {row.visibleFrom ? formatDateTime(row.visibleFrom) : t('adminContent.table.anytime')}
              {' → '}
              {row.visibleUntil ? formatDateTime(row.visibleUntil) : t('adminContent.table.ongoing')}
            </Typography>
          )
        }
        return <Typography variant="body2">{t('common.na')}</Typography>
      }
    },
    {
      field: 'actions',
      headerName: t('adminContent.table.actions'),
      sortable: false,
      minWidth: 260,
      renderCell: (params) => {
        const row = params.row as ContentPost
        return (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => navigate(`/admin/content/${row.id}`)}>
              {t('common.edit')}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={row.status === 'PUBLISHED'}
              onClick={() => setConfirmAction({ type: 'publish', post: row })}
            >
              {t('adminContent.actions.publish')}
            </Button>
            <Button
              size="small"
              variant="text"
              disabled={row.status === 'ARCHIVED'}
              onClick={() => setConfirmAction({ type: 'archive', post: row })}
            >
              {t('adminContent.actions.archive')}
            </Button>
          </Stack>
        )
      }
    }
  ], [navigate, t])

  return (
    <Stack spacing={3}>
      <Button onClick={() => navigate('/admin/session-briefings')}>{t('editorial.adminTitle')}</Button>
      <Button disabled={actionLoading} onClick={async () => { setActionLoading(true); try { await apiPost('/strategies/mentor/seed', {}); await loadContent() } catch { setError(t('dailyReview.saveError')) } finally { setActionLoading(false) } }}>{t('prepare.seed')}</Button>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Button variant="contained" onClick={() => navigate('/admin/content/new')} fullWidth={isCompact}>
          {t('adminContent.actions.createNew')}
        </Button>
        <Button variant="outlined" onClick={() => navigate('/admin/content/types')} fullWidth={isCompact}>
          {t('adminContent.actions.manageTypes')}
        </Button>
      </Stack>

      {isSuperAdmin && (
        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack spacing={0.75}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {t('adminContent.maintenance.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('adminContent.maintenance.subtitle')}
                </Typography>
              </Stack>
              <Alert severity="warning">
                {t('adminContent.maintenance.warning')}
              </Alert>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('adminContent.maintenance.confirmation')}
                  value={resetConfirmation}
                  onChange={(event) => setResetConfirmation(event.target.value)}
                  helperText={t('adminContent.maintenance.confirmationHint', { phrase: DATABASE_RESET_CONFIRMATION })}
                />
                <TextField
                  fullWidth
                  type="password"
                  label={t('adminContent.maintenance.password')}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <Button
                  color="error"
                  variant="contained"
                  disabled={!resetReady}
                  onClick={() => setResetDialogOpen(true)}
                  sx={{ minWidth: { md: 220 } }}
                >
                  {resetLoading ? t('adminContent.actions.working') : t('adminContent.maintenance.openDialog')}
                </Button>
              </Stack>
              {resetResult && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    {t('adminContent.maintenance.lastResult')}
                  </Typography>
                  {deletedRows.length > 0 ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {deletedRows.slice(0, 12).map(([table, count]) => (
                        <Alert key={table} severity="info" sx={{ py: 0 }}>
                          {table}: {count}
                        </Alert>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('adminContent.maintenance.noRowsDeleted')}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label={t('common.search')}
                placeholder={t('adminContent.searchPlaceholder')}
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label={t('adminContent.table.type')}
                value={filters.contentTypeId}
                onChange={(event) => setFilters((prev) => ({ ...prev, contentTypeId: event.target.value }))}
              >
                <MenuItem value="">{t('adminContent.types.all')}</MenuItem>
                {contentTypes.map((contentType) => (
                  <MenuItem key={contentType.id} value={contentType.id}>
                    {contentType.displayName}
                    {!contentType.active ? ` (${t('adminTypes.status.inactive')})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label={t('adminContent.table.status')}
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.label} value={option.value}>{t(option.label)}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {(loading && items.length === 0) || (typesLoading && contentTypes.length === 0) ? (
        <Card>
          <CardContent>
            <LoadingState rows={5} height={32} />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('adminContent.empty.title')}
          description={t('adminContent.empty.body')}
          action={<Button variant="contained" onClick={() => navigate('/admin/content/new')}>{t('adminContent.actions.createContent')}</Button>}
        />
      ) : (
        <Card>
          <CardContent sx={{ height: isCompact ? 560 : 640 }}>
            <DataGrid
              rows={items}
              columns={columns}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              paginationMode="server"
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              rowCount={totalRows}
              loading={loading}
              pageSizeOptions={[5, 10, 20]}
              columnVisibilityModel={columnVisibilityModel}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmAction?.type === 'publish' ? t('adminContent.dialog.publishTitle') : t('adminContent.dialog.archiveTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmAction?.type === 'publish'
              ? t('adminContent.dialog.publishBody')
              : t('adminContent.dialog.archiveBody')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmAction(null)} disabled={actionLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleConfirm} disabled={actionLoading}>
            {actionLoading ? t('adminContent.actions.working') : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetDialogOpen} onClose={() => !resetLoading && setResetDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('adminContent.maintenance.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="error">
              {t('adminContent.maintenance.dialogBody')}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              {t('adminContent.maintenance.preserved')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setResetDialogOpen(false)} disabled={resetLoading}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDatabaseReset} disabled={!resetReady}>
            {resetLoading ? t('adminContent.actions.working') : t('adminContent.maintenance.confirmReset')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
