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
  FormControlLabel,
  Grid,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../../components/ui/LoadingState'
import ErrorBanner from '../../components/ui/ErrorBanner'
import EmptyState from '../../components/ui/EmptyState'
import { ApiError } from '../../api/client'
import { ContentType, ContentTypeRequest, createContentType, listAdminContentTypes, updateContentType } from '../../api/content'
import { useI18n } from '../../i18n'
import { translateApiError } from '../../i18n/errorMessages'

type TypeTranslationForm = {
  displayName: string
  description: string
}

type TypeFormState = {
  id?: string
  key: string
  sortOrder: number
  active: boolean
  translations: {
    en: TypeTranslationForm
    ro: TypeTranslationForm
  }
}

const KEY_PATTERN = /^[A-Z0-9_]+$/

const emptyForm: TypeFormState = {
  key: '',
  sortOrder: 10,
  active: true,
  translations: {
    en: { displayName: '', description: '' },
    ro: { displayName: '', description: '' }
  }
}

const toForm = (contentType: ContentType): TypeFormState => ({
  id: contentType.id,
  key: contentType.key,
  sortOrder: contentType.sortOrder,
  active: contentType.active,
  translations: {
    en: {
      displayName: contentType.translations?.en?.displayName || '',
      description: contentType.translations?.en?.description || ''
    },
    ro: {
      displayName: contentType.translations?.ro?.displayName || '',
      description: contentType.translations?.ro?.description || ''
    }
  }
})

export default function AdminContentTypesPage() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const isCompact = useMediaQuery('(max-width:560px)')
  const [items, setItems] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tabLocale, setTabLocale] = useState<'en' | 'ro'>('en')
  const [form, setForm] = useState<TypeFormState>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const loadTypes = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listAdminContentTypes({ includeInactive: true })
      setItems(data)
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

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'displayName',
      headerName: t('adminTypes.table.name'),
      minWidth: 220,
      flex: 1,
      renderCell: (params) => {
        const row = params.row as ContentType
        const roMissing = (row.missingLocales || []).includes('ro')
        return (
          <Stack spacing={0.25}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{row.displayName}</Typography>
            <Stack direction="row" spacing={1}>
              <Typography variant="caption" color="text.secondary">{row.key}</Typography>
              {roMissing && <Typography variant="caption" color="warning.main">{t('adminContent.badges.roMissing')}</Typography>}
            </Stack>
          </Stack>
        )
      }
    },
    {
      field: 'sortOrder',
      headerName: t('adminTypes.table.sortOrder'),
      minWidth: 120
    },
    {
      field: 'active',
      headerName: t('adminTypes.table.status'),
      minWidth: 140,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.row.active ? t('adminTypes.status.active') : t('adminTypes.status.inactive')}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: t('adminTypes.table.actions'),
      minWidth: 160,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" variant="outlined" onClick={() => {
          setForm(toForm(params.row as ContentType))
          setFieldErrors({})
          setTabLocale('en')
          setDialogOpen(true)
        }}>
          {t('common.edit')}
        </Button>
      )
    }
  ], [t])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    const normalizedKey = form.key.trim().toUpperCase()

    if (!normalizedKey) {
      nextErrors.key = t('adminTypes.validation.keyRequired')
    } else if (!KEY_PATTERN.test(normalizedKey)) {
      nextErrors.key = t('adminTypes.validation.keyFormat')
    }

    if (!form.translations.en.displayName.trim()) {
      nextErrors.enDisplayName = t('adminTypes.validation.enDisplayNameRequired')
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const buildPayload = (): ContentTypeRequest => ({
    key: form.key.trim().toUpperCase(),
    active: form.active,
    sortOrder: form.sortOrder,
    translations: {
      en: {
        displayName: form.translations.en.displayName.trim(),
        description: form.translations.en.description.trim() || undefined
      },
      ro: {
        displayName: form.translations.ro.displayName.trim(),
        description: form.translations.ro.description.trim() || undefined
      }
    }
  })

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (form.id) {
        await updateContentType(form.id, payload)
      } else {
        await createContentType(payload)
      }
      setSnackbar({ open: true, message: t('adminTypes.messages.saved'), severity: 'success' })
      setDialogOpen(false)
      setForm(emptyForm)
      loadTypes()
    } catch (err) {
      const apiErr = err as ApiError
      setSnackbar({ open: true, message: translateApiError(apiErr, t, 'adminTypes.messages.saveFailed'), severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Button variant="outlined" onClick={() => navigate('/admin/content')} fullWidth={isCompact}>
          {t('adminTypes.actions.backToContent')}
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setForm(emptyForm)
            setFieldErrors({})
            setTabLocale('en')
            setDialogOpen(true)
          }}
          fullWidth={isCompact}
        >
          {t('adminTypes.actions.create')}
        </Button>
      </Stack>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Card>
          <CardContent>
            <LoadingState rows={5} height={32} />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('adminTypes.empty.title')}
          description={t('adminTypes.empty.body')}
          action={(
            <Button variant="contained" onClick={() => setDialogOpen(true)}>
              {t('adminTypes.actions.create')}
            </Button>
          )}
        />
      ) : (
        <Card>
          <CardContent sx={{ height: isCompact ? 520 : 620 }}>
            <DataGrid
              rows={items}
              columns={columns}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 20, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 }
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{form.id ? t('adminTypes.dialog.editTitle') : t('adminTypes.dialog.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('adminTypes.fields.key')}
                  value={form.key}
                  onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value.toUpperCase() }))}
                  error={Boolean(fieldErrors.key)}
                  helperText={fieldErrors.key || t('adminTypes.fields.keyHint')}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('adminTypes.fields.sortOrder')}
                  value={form.sortOrder}
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={form.active}
                      onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                    />
                  )}
                  label={form.active ? t('adminTypes.status.active') : t('adminTypes.status.inactive')}
                />
              </Grid>
            </Grid>

            <Tabs value={tabLocale} onChange={(_, value) => setTabLocale(value)}>
              <Tab value="en" label="EN" />
              <Tab value="ro" label="RO" />
            </Tabs>

            <TextField
              fullWidth
              label={t('adminTypes.fields.displayName')}
              value={form.translations[tabLocale].displayName}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                translations: {
                  ...prev.translations,
                  [tabLocale]: {
                    ...prev.translations[tabLocale],
                    displayName: event.target.value
                  }
                }
              }))}
              error={tabLocale === 'en' && Boolean(fieldErrors.enDisplayName)}
              helperText={tabLocale === 'en' ? fieldErrors.enDisplayName : ''}
            />

            <TextField
              fullWidth
              label={t('adminTypes.fields.description')}
              value={form.translations[tabLocale].description}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                translations: {
                  ...prev.translations,
                  [tabLocale]: {
                    ...prev.translations[tabLocale],
                    description: event.target.value
                  }
                }
              }))}
              multiline
              minRows={3}
            />

            {(form.translations.ro.displayName.trim() === '') && (
              <Alert severity="warning">{t('adminContent.badges.roMissing')}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDialogOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? t('adminTypes.actions.saving') : t('common.save')}
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
