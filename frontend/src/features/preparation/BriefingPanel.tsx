import { useQuery } from '@tanstack/react-query'
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../../api/client'
import { Preparation } from '../../api/sessionReviews'
import { useI18n } from '../../i18n'
import { Composition, Selection, Slot, editorialDate, slots } from '../briefings/model'
import { EditorialComposition } from '../briefings/EditorialView'
import { MarketMonitor } from '../briefings/MarketMonitor'
import { LegacyBriefingPanel } from './LegacyBriefingPanel'
import { selectBriefing } from './context'

export function BriefingPanel({ date, preparation:p,onVersion,onSelection,coach=false }: {date:string;preparation:Preparation;onVersion:(id:string)=>void;onSelection?:(p:Partial<Preparation>)=>void;coach?:boolean}) {
 const {t}=useI18n();const [error,setError]=useState('');const [busy,setBusy]=useState(false);const loading=useRef(false)
 const selectedDate=p.briefingDate || date
 const mounted=useRef(true)
 const selectionKey=`${date}:${selectedDate}:${p.manualSession}:${p.briefingSession}`
 const latestSelection=useRef(selectionKey);latestSelection.current=selectionKey
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 const current=useQuery({queryKey:['editorialSelection',p.manualSession?selectedDate:'current-editorial-date',p.manualSession?p.briefingSession:'auto'],queryFn:()=>apiGet<Selection>(`/session-briefings?date=${p.manualSession?selectedDate:editorialDate()}${p.manualSession?`&slot=${p.briefingSession}`:''}`),refetchInterval:30000,retry:false})
 const frozen=useQuery({queryKey:['preparationBriefingVersion',p.briefingId],queryFn:()=>apiGet<Composition>(`/today/briefing/version/${p.briefingId}`),enabled:Boolean(p.briefingId),staleTime:Infinity,retry:false})
 async function capture() {
  if(loading.current)return;loading.current=true;setBusy(true);setError('');const requestedKey=selectionKey
  const slot=p.manualSession?p.briefingSession:current.data?.requestedSlot || selectBriefing(new Date())
  const requestedDate=p.manualSession?selectedDate:current.data?.requestedDate || editorialDate()
  try {const result=await apiPost<Composition>(`/session-briefings/capture/${date}`,{editorialDate:requestedDate,slot});
   if(!mounted.current || latestSelection.current!==requestedKey)return
   if(onSelection)onSelection({briefingId:result.id,briefingSession:slot,briefingDate:requestedDate,contextAcknowledged:false,preparationConfirmed:false});else onVersion(result.id)
  }catch(e){setError(e instanceof Error?e.message:t('dailyReview.loadError'))}finally{loading.current=false;setBusy(false)}
 }
 const captureAction=useRef(capture);captureAction.current=capture
 useEffect(()=>{if(!p.briefingId && current.data)void captureAction.current()},[p.briefingId,current.data])
 if(frozen.data && frozen.data.kind!=='EDITORIAL')return <LegacyBriefingPanel date={date} preparation={p} onVersion={onVersion} coach={coach}/>
 const data=frozen.data
 const newer=data && current.data?.selected && data.selected?.id!==current.data.selected.id
 const missingNext=data && current.data?.missingPreferred && !newer && (data.requestedSlot!==current.data.requestedSlot || data.requestedDate!==current.data.requestedDate)
 return <Stack spacing={2}>
 {!coach && <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
 <TextField type="date" label={t('editorial.editorialDate')} value={selectedDate} InputLabelProps={{shrink:true}} onChange={e=>{if(e.target.value)onSelection?.({briefingDate:e.target.value,manualSession:true,briefingId:undefined,contextAcknowledged:false,preparationConfirmed:false})}}/>
 <TextField select label={t('prepare.session')} value={p.briefingSession} onChange={e=>onSelection?.({briefingSession:e.target.value as Slot,briefingDate:selectedDate,manualSession:true,briefingId:undefined,contextAcknowledged:false,preparationConfirmed:false})}>{slots.map(slot=><MenuItem value={slot} key={slot}>{t(`editorial.${slot}`)}</MenuItem>)}</TextField>
 <Button disabled={busy} onClick={()=>void capture()}>{t('editorial.refreshSelection')}</Button>
 </Stack>}
 {missingNext && <Alert severity="info">{t('editorial.missing')}: {current.data?.requestedDate} · {t(`editorial.${current.data?.requestedSlot}`)}. {t('editorial.contextRetained')}</Alert>}
 {newer && <Alert severity="info" action={<Button disabled={busy} onClick={()=>void capture()}>{t('editorial.switch')}</Button>}>{t('editorial.newer')}</Alert>}
 {(error || current.isError || frozen.isError) && <Alert severity="warning">{error || t('dailyReview.loadError')} · {t('editorial.manualAllowed')}<Button disabled={busy} onClick={()=>void capture()}>{t('dailyReview.retry')}</Button></Alert>}
 {(busy || frozen.isFetching) && <Typography role="status">{t('dailyReview.loading')}</Typography>}
 {data && <EditorialComposition capture={data} scenariosOnly={coach}/>}
 {!coach && <MarketMonitor historical={selectedDate!==editorialDate()}/>}
 </Stack>
}
