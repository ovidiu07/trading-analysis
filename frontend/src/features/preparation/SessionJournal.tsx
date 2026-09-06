import { strategyText } from './context'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { apiPost, apiPut } from '../../api/client'
import { NotebookNote } from '../../api/notebook'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/AuthContext'

export function SessionJournal({ accountId, date, session }: { accountId: string; date: string; session: string }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const url = `/today/journals/${accountId}/${date}?session=${session}`
  const key = `preparation.journal.${user?.id}.${accountId}.${date}.${session}`
  const [note, setNote] = useState<NotebookNote>()
  const [body, setBody] = useState('')
  const [state, setState] = useState('saved')
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    apiPost<NotebookNote>(url, {}).then(value => {
      if (!active) return
      setNote(value)
      const local = localStorage.getItem(key)
      setBody(local ?? strategyText(value.body))
      if (local !== null && local !== strategyText(value.body)) setState('error')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [url, key])
  const change = (value: string) => { setBody(value); setState('draft'); localStorage.setItem(key, value) }
  const save = async () => {
    if (!note || pending.current || note.isDeleted) return
    pending.current = true; setState('saving')
    try {
      const saved = await apiPut<NotebookNote>(url, { body, updatedAt: note.updatedAt })
      setNote(saved); setState('saved'); if (localStorage.getItem(key) === body) localStorage.removeItem(key)
    } catch { setState('error') } finally { pending.current = false }
  }
  const saveLatest = useRef(save)
  saveLatest.current = save
  useEffect(() => {
    if (state !== 'draft') return
    const timer = window.setTimeout(() => void saveLatest.current(), 900)
    return () => window.clearTimeout(timer)
  }, [body, state])
  return <Stack spacing={1}>
    <Typography variant="h6" component="h2">{t('prepare.journal')}</Typography>
    <Typography role="status" variant="caption">{t(`dailyReview.save.${state}`)}</Typography>
    {state === 'error' && <Alert severity="error">{t('prepare.journalConflict')}</Alert>}
    {note?.isDeleted && <Alert severity="warning">{t('prepare.journalDeleted')}</Alert>}
    <TextField label={t('prepare.journal')} multiline minRows={7} value={body} disabled={!note || note.isDeleted || state === 'saving'} inputProps={{ maxLength: 50000 }} onChange={e => change(e.target.value)} />
    <Button disabled={!note || note.isDeleted || state === 'saving'} onClick={() => change(`${body}${body ? '\n\n' : ''}[${new Date().toISOString()}] `)}>{t('prepare.timestamp')}</Button>
    <Button disabled={!note || note.isDeleted || state === 'saving'} onClick={() => void save()}>{t('dailyReview.saveDraft')}</Button>
    {note && <Button component={Link} to={`/notebook?noteId=${note.id}`}>{t('prepare.openNotebook')}</Button>}
  </Stack>
}
