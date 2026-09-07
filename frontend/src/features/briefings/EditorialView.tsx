import { Alert, Box, Chip, Link, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { useI18n } from '../../i18n'
import { BriefingDocument, Composition, Publication, Translation } from './model'

export function EditorialDocument({ document: d, scenariosOnly=false }: { document: BriefingDocument; scenariosOnly?: boolean }) {
 const { language,t }=useI18n()
 const resolved=d.translations[language] ? language : d.contentLanguage
 const content=d.translations[resolved]
 if(!content) return <Alert severity="warning">{t('editorial.translationMissing')}</Alert>
 const detail=(key: keyof Translation,children: React.ReactNode)=><Box component="details" key={key}><Box component="summary" sx={{cursor:'pointer',py:1,fontWeight:600}}>{t(`editorial.${key}`)}</Box><Stack spacing={1}>{children}</Stack></Box>
 const source=(name: string,url?: string|null)=><Typography variant="caption">{url && /^https?:\/\//.test(url)?<Link href={url} target="_blank" rel="noopener noreferrer">{name}</Link>:name}</Typography>
 return <Stack spacing={1} lang={resolved} sx={{overflowWrap:'anywhere',minWidth:0}}>
 {resolved!==language && <Alert severity="info">{t('editorial.availableLanguage')}: {resolved.toUpperCase()}</Alert>}
 <Typography component="h3" variant="h6">{content.title}</Typography>
 <Typography variant="caption">{d.editorialDate} · {t(`editorial.${d.slot}`)} · Europe/Bucharest · {d.author}</Typography>
 <Typography variant="caption">{t('editorial.referenceTime')}: {d.referenceTime} · {t('editorial.coverage')}: {d.coverageStart} — {d.coverageEnd} · {t(`editorial.${d.coverage}`)}</Typography>
 {d.aiDisclosure && <Typography variant="caption">{d.aiDisclosure}</Typography>}
 {!scenariosOnly && <><Box component="ul" sx={{pl:2.5,my:0}}>{content.summary.map((s,i)=><Typography component="li" key={i}>{s}</Typography>)}</Box>
 {detail('facts',content.facts.map(f=><Box key={f.id} id={`fact-${d.slot}-${f.id}`} sx={{borderLeft:2,borderColor:f.relationship==='CORRECTION'?'warning.main':'divider',pl:1.5}}>
 <Typography variant="caption">{f.time || '—'} · {f.topic} · {f.id}</Typography>
 {f.relationship && <Typography color={f.relationship==='CORRECTION'?'warning.main':'text.secondary'}>{t(`editorial.${f.relationship}`)} → {f.relatedFactId}</Typography>}
 <Typography sx={{whiteSpace:'pre-wrap'}}>{f.statement}</Typography>{source(f.source,f.sourceUrl)}
 <Typography variant="caption" display="block">{t('editorial.availableAt')}: {f.availableAt || f.availabilityNotEstablished}</Typography></Box>))}
 {detail('news',content.news.map((n,i)=><Box key={i}><Typography fontWeight={600}>{n.headline}</Typography><Typography variant="caption">{n.publishedAt}</Typography><Typography>{n.summary}</Typography><Typography>{n.relevance}</Typography>{source(n.source,n.sourceUrl)}</Box>))}
 {detail('events',content.events.map(e=><Box key={e.id}><Typography>{e.name} · {e.region} · {t(`editorial.${e.status}`)}</Typography><Typography variant="caption">{e.scheduledAt} · {e.timezone} · {e.id}</Typography><Typography>{t('editorial.actual')}: {e.actual ?? '—'} · {t('editorial.forecast')}: {e.forecast ?? '—'} · {t('editorial.previous')}: {e.previous ?? '—'} {e.unit}</Typography><Typography>{e.explanation}</Typography>{source(e.source,e.sourceUrl)}</Box>))}
 {detail('macro',<><Alert severity="info">{t('editorial.snapshot')}</Alert>{content.macro.map((m,i)=><Box key={i}><Typography>{m.instrument} · {m.type}: {m.value ?? '—'} {m.unit}</Typography><Typography variant="caption">{m.observedAt} · {m.availability}</Typography>{m.referenceValue!=null && <Typography variant="body2">{t('editorial.referenceValue')}: {m.referenceValue} · {m.referenceAt}</Typography>}{m.type.toUpperCase()==='YIELD' && m.value!=null && m.referenceValue!=null && <Typography variant="body2">Δ {((m.value-m.referenceValue)*100).toFixed(2)} bp</Typography>}{source(m.source,m.sourceUrl)}</Box>)}</>)}
 </>}
 {(scenariosOnly || content.scenarios.length>0) && <><Typography fontWeight={600}>{t('editorial.publishedAnalysis')}</Typography>{content.scenarios.length===0 && <Typography>{t('editorial.noScenarios')}</Typography>}{content.scenarios.map(s=><Box key={s.market} sx={{p:1.5,border:1,borderColor:'divider',borderRadius:1}}><Typography component="h4">{s.instrument} · {s.source} · {s.type} {s.contract}</Typography><Chip size="small" label={t(`prepare.${s.bias}`)} />{(['context','main','alternative','invalidation','risks','limitations'] as const).map(k=><Typography key={k} sx={{whiteSpace:'pre-wrap'}}><strong>{t(`editorial.${k}`)}: </strong>{s[k]}</Typography>)}</Box>)}</>}
 <Typography variant="body2">{content.sourcesAndLimitations}</Typography>
 </Stack>
}
export function PublicationView({publication,scenariosOnly=false}: {publication: Publication;scenariosOnly?:boolean}) {
 const {t}=useI18n()
 return <Stack spacing={1}>{publication.withdrawn && <Alert severity="warning">{t('editorial.withdrawnNotice')}</Alert>}<Typography variant="caption">{t('editorial.firstPublished')}: {publication.firstPublishedAt} · {t('editorial.publishedAt')}: {publication.publishedAt} · r{publication.revision}</Typography><EditorialDocument document={publication.document} scenariosOnly={scenariosOnly}/></Stack>
}
export function EditorialComposition({capture,scenariosOnly=false}: {capture:Composition;scenariosOnly?:boolean}) {
 const {t}=useI18n()
 const withdrawals=useQuery({queryKey:['editorialWithdrawals',capture.id],queryFn:()=>apiGet<string[]>(`/session-briefings/capture/${capture.id}/withdrawals`),enabled:Boolean(capture.id),refetchInterval:60000})
 const selected=capture.selected
 const seen=new Set<string>()
 return <Stack spacing={2}>
 {Boolean(withdrawals.data?.length) && <Alert severity="warning">{t('editorial.withdrawnNotice')}</Alert>}
 {capture.missingPreferred && <Alert severity="warning">{t('editorial.missing')}: {capture.requestedDate} · {t(`editorial.${capture.requestedSlot}`)}. {t('editorial.manualAllowed')}</Alert>}
 {selected ? <><PublicationView publication={selected} scenariosOnly={scenariosOnly}/><Typography variant="caption">{t('editorial.capturedAt')}: {capture.capturedAt} · {t('editorial.age')}: {Math.max(0,Math.floor((new Date(capture.capturedAt).getTime()-new Date(selected.publishedAt).getTime())/3600000))} h</Typography></>:<Typography>{t('editorial.noPublication')}</Typography>}
 {!scenariosOnly && <><Typography component="h3" variant="h6">{t('editorial.daySoFar')}</Typography>
 {capture.composition?.map(p=>{
 const language=p.document.contentLanguage;const facts=p.document.translations[language]?.facts || []
 const repeats=facts.filter(f=>seen.has(f.id)).map(f=>f.id);facts.forEach(f=>seen.add(f.id))
 return <Box component="details" key={p.id}><Box component="summary" sx={{cursor:'pointer',py:1}}>{t(`editorial.${p.document.slot}`)} · {p.document.referenceTime} · r{p.revision}</Box>{repeats.length>0 && <Typography variant="caption">{t('editorial.repeatedFacts')}: {repeats.join(', ')}</Typography>}<PublicationView publication={p}/></Box>
 })}
 {capture.previousRecap && capture.previousRecap.document.editorialDate!==selected?.document.editorialDate && <Box component="details" sx={{borderTop:1,borderColor:'divider',pt:1}}><Box component="summary" sx={{cursor:'pointer',py:1}}>{t('editorial.previousDay')} · {capture.previousRecap.document.editorialDate}</Box><PublicationView publication={capture.previousRecap}/></Box>}
 </>}
 </Stack>
}
