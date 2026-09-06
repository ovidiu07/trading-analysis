import { Box, Link, Stack, Typography } from '@mui/material'
import { useI18n } from '../../i18n'
export type Feed = { news?: Row[]; events?: Row[]; macro?: Row[] }
type Row = { title?: string; name?: string; source: string; url: string; time: string; relevance?: string; phase?: string; actual?: number; forecast?: number; previous?: number; value?: number; unit?: string; change?: number; changeUnit?: string; referenceValue?: number; referenceTime?: string; status?: string; benchmark?: string }
export function ContextFeed({ feed }: { feed?: Feed }) {
 const { t }=useI18n()
 return <Stack spacing={2}>
  <Box sx={{ display:'flex', flexWrap:'wrap', gap:1 }}>{['Brent','WTI','DXY','US 2Y','US 10Y','DE 2Y','DE 10Y'].map(name=>{
   const row=feed?.macro?.find(x=>x.name===name)
   return <Box key={name} sx={{ p:1,border:1,borderColor:'divider',borderRadius:1 }}><Typography variant="body2">{name} {row?.benchmark} · {row?.value ?? '—'} {row?.unit} · {row?.status || t('prepare.noData')}</Typography>{row && <><Typography variant="caption">Δ {row.change ?? '—'} {row.changeUnit} · {t('prepare.reference')}: {row.referenceValue ?? '—'} · {row.referenceTime}</Typography><Typography variant="caption" display="block">{row.time} · <Link href={row.url} target="_blank" rel="noopener noreferrer">{row.source}</Link></Typography></>}</Box>
  })}</Box>
  {feed?.news?.map((row,index)=><Box key={index}><Typography variant="caption">{t(new Date(row.time).getUTCDay() % 6 === 0 ? 'prepare.weekendNews' : 'prepare.marketNews')}</Typography><Link href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</Link><Typography variant="caption" display="block">{row.time} · {row.source}</Typography><Typography variant="body2">{row.relevance}</Typography></Box>)}
  {['published','upcoming'].map(phase=><Stack spacing={1} key={phase}><Typography fontWeight={700}>{t(`prepare.${phase}`)}</Typography>{!feed?.events?.some(x=>x.phase===phase) && <Typography variant="caption">{t('prepare.noData')}</Typography>}{feed?.events?.filter(x=>x.phase===phase).map((row,index)=><Box key={index}><Link href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</Link><Typography variant="caption" display="block">{row.time} · {row.source} · {row.actual!=null ? `Actual ${row.actual} ` : ''}{row.forecast!=null ? `Forecast ${row.forecast} ` : ''}{row.previous!=null ? `Previous ${row.previous}` : ''}</Typography></Box>)}</Stack>)}
 </Stack>
}
