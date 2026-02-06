import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import ErrorBanner from '../../components/ui/ErrorBanner'
import LoadingState from '../../components/ui/LoadingState'
import { ApiError } from '../../api/client'
import {
  ContentPost,
  ContentPostStatus,
  ContentPostType,
  archiveContent,
  listAdminContent,
  publishContent
} from '../../api/content'
import { formatDate, formatDateTime } from '../../utils/format'
import { useNavigate } from 'react-router-dom'

const statusOptions: { label: string; value: ContentPostStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Archived', value: 'ARCHIVED' }
]

const typeOptions: { label: string; value: ContentPostType | '' }[] = [
  { label: 'All types', value: '' },
  { label: 'Strategy', value: 'STRATEGY' },
  { label: 'Weekly plan', value: 'WEEKLY_PLAN' }
]

type ActionState = {
  type: 'publish' | 'archive'
  post: ContentPost
}

export default function AdminContentPage() {
  const navigate = useNavigate()
  const isCompact = useMediaQuery('(max-width:560px)')
  const [items, setItems] = useState<ContentPost[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ q: '', type: '', status: '' })
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 })
  const [confirmAction, setConfirmAction] = useState<ActionState | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
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

  const loadContent = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listAdminContent({
        page: paginationModel.page,
        size: paginationModel.pageSize,
        q: filters.q,
        type: filters.type ? (filters.type as ContentPostType) : undefined,
        status: filters.status ? (filters.status as ContentPostStatus) : undefined
      })
      setItems(data.content)
      setTotalRows(data.totalElements)
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Unable to load content')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadContent()
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, paginationModel])

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction.type === 'publish') {
        await publishContent(confirmAction.post.id)
        setSnackbar({ open: true, message: 'Content published', severity: 'success' })
      } else {
        await archiveContent(confirmAction.post.id)
        setSnackbar({ open: true, message: 'Content archived', severity: 'success' })
      }
      setConfirmAction(null)
      loadContent()
    } catch (err) {
      const apiErr = err as ApiError
      setSnackbar({ open: true, message: apiErr.message || 'Action failed', severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1.4,
      minWidth: 180,
      renderCell: (params) => (
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{params.row.title}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.row.summary || 'No summary'}
          </Typography>
        </Stack>
      )
    },
    {
      field: 'type',
      headerName: 'Type',
      minWidth: 140,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.type === 'STRATEGY' ? 'Strategy' : 'Weekly plan'}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 130,
      renderCell: (params) => (
        <Typography variant="body2">{params.row.status}</Typography>
      )
    },
    {
      field: 'updatedAt',
      headerName: 'Updated',
      minWidth: 170,
      renderCell: (params) => (
        <Typography variant="body2">{formatDateTime(params.row.updatedAt)}</Typography>
      )
    },
    {
      field: 'visibleRange',
      headerName: 'Visible range',
      minWidth: 200,
      flex: 1,
      renderCell: (params) => {
        const row = params.row as ContentPost
        if (row.type === 'WEEKLY_PLAN' && row.weekStart && row.weekEnd) {
          return (
            <Typography variant="body2">
              {formatDate(row.weekStart)} – {formatDate(row.weekEnd)}
            </Typography>
          )
        }
        if (row.visibleFrom || row.visibleUntil) {
          return (
            <Typography variant="body2">
              {row.visibleFrom ? formatDateTime(row.visibleFrom) : 'Anytime'}
              {' → '}
              {row.visibleUntil ? formatDateTime(row.visibleUntil) : 'Ongoing'}
            </Typography>
          )
        }
        return <Typography variant="body2">—</Typography>
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      minWidth: 260,
      renderCell: (params) => {
        const row = params.row as ContentPost
        return (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => navigate(`/admin/content/${row.id}`)}>
              Edit
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={row.status === 'PUBLISHED'}
              onClick={() => setConfirmAction({ type: 'publish', post: row })}
            >
              Publish
            </Button>
            <Button
              size="small"
              variant="text"
              disabled={row.status === 'ARCHIVED'}
              onClick={() => setConfirmAction({ type: 'archive', post: row })}
            >
              Archive
            </Button>
          </Stack>
        )
      }
    }
  ], [navigate])

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Admin Content"
        subtitle="Create, publish, and archive strategies or weekly plans."
        actions={(
          <Button variant="contained" onClick={() => navigate('/admin/content/new')}>
            Create new
          </Button>
        )}
      />

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Search"
                placeholder="Title, summary, or body"
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Type"
                value={filters.type}
                onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
              >
                {typeOptions.map((option) => (
                  <MenuItem key={option.label} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Status"
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.label} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading && items.length === 0 ? (
        <Card>
          <CardContent>
            <LoadingState rows={5} height={32} />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No content yet"
          description="Create your first strategy or weekly plan to publish it to Insights."
          action={<Button variant="contained" onClick={() => navigate('/admin/content/new')}>Create content</Button>}
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
        <DialogTitle>{confirmAction?.type === 'publish' ? 'Publish content' : 'Archive content'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmAction?.type === 'publish'
              ? 'Publish this content to Insights? All users will see it immediately.'
              : 'Archive this content? It will be hidden from Insights but kept for records.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirm} disabled={actionLoading}>
            {actionLoading ? 'Working…' : 'Confirm'}
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
