import '@testing-library/jest-dom/vitest'
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react'
import { QueryClient,QueryClientProvider } from '@tanstack/react-query'
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest'
import { BriefingPanel } from './BriefingPanel'
import { initialPreparation } from './context'
import { apiGet,apiPost } from '../../api/client'
vi.mock('../../api/client',()=>({apiGet:vi.fn(),apiPost:vi.fn()}))
vi.mock('../../i18n',()=>({useI18n:()=>({t:(key:string)=>key,language:'en'})}))
vi.mock('../briefings/EditorialView',()=>({EditorialComposition:({capture}:{capture:{id:string}})=><div>frozen:{capture.id}</div>}))
vi.mock('../briefings/MarketMonitor',()=>({MarketMonitor:()=>null}))
vi.mock('./LegacyBriefingPanel',()=>({LegacyBriefingPanel:()=>null}))
const original={id:'capture-original',kind:'EDITORIAL',requestedDate:'2026-09-07',requestedSlot:'ASIA',selected:{id:'publication-asia'},composition:[]}
const current={requestedDate:'2026-09-07',requestedSlot:'LONDON',selected:{id:'publication-london'},available:[]}
afterEach(cleanup)
beforeEach(()=>{vi.mocked(apiGet).mockImplementation(async path=>path.includes('/version/')?original:current as never);vi.mocked(apiPost).mockResolvedValue({...original,id:'capture-new'})})
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const onSelection=vi.fn();const onVersion=vi.fn();const p={...initialPreparation('2026-09-07'),briefingId:original.id,briefingSession:'ASIA' as const};const view=(prep=p)=><QueryClientProvider client={client}><BriefingPanel date="2026-09-07" preparation={prep} onSelection={onSelection} onVersion={onVersion}/></QueryClientProvider>;return {onSelection,onVersion,p,view}}
describe('active editorial preparation',()=>{
 it('announces a clock/publication update without silently replacing active context',async()=>{const x=setup();render(x.view());await screen.findByText('frozen:capture-original');await screen.findByText('editorial.newer');expect(x.onSelection).not.toHaveBeenCalled();expect(x.onVersion).not.toHaveBeenCalled();expect(apiPost).not.toHaveBeenCalled()})
 it('does not announce a newer publication when the next slot is missing',async()=>{vi.mocked(apiGet).mockImplementation(async path=>path.includes('/version/')?original:{...current,selected:original.selected,missingPreferred:true} as never);const x=setup();render(x.view());await screen.findByText(/editorial.contextRetained/);expect(screen.queryByText('editorial.newer')).not.toBeInTheDocument();expect(x.onSelection).not.toHaveBeenCalled()})
 it('explicit switching captures context and clears confirmations',async()=>{const x=setup();render(x.view());fireEvent.click(await screen.findByRole('button',{name:'editorial.switch'}));await waitFor(()=>expect(x.onSelection).toHaveBeenCalledWith(expect.objectContaining({briefingId:'capture-new',briefingSession:'LONDON',contextAcknowledged:false,preparationConfirmed:false})))})
 it('discarded selection requests cannot overwrite a newer manual choice',async()=>{let resolve!:(v:unknown)=>void;vi.mocked(apiPost).mockReturnValue(new Promise(r=>{resolve=r}) as never);const x=setup();const mounted=render(x.view());fireEvent.click(await screen.findByRole('button',{name:'editorial.switch'}));await waitFor(()=>expect(apiPost).toHaveBeenCalled());mounted.rerender(x.view({...x.p,briefingDate:'2026-09-04',manualSession:true}));resolve({...original,id:'late-response'});await waitFor(()=>expect(screen.queryByText('dailyReview.loading')).not.toBeInTheDocument());expect(x.onSelection).not.toHaveBeenCalled()})
})
