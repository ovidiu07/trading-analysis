import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { emptyReview, type SessionReview } from '../../api/sessionReviews'
import { initialPreparation } from './context'
import { PrepareSteps } from './PrepareSteps'
import { createSetupCandidate, getSessionWorkspace } from '../../api/liveWorkspace'

vi.mock('../../api/liveWorkspace', () => ({ getSessionWorkspace: vi.fn(), createSetupCandidate: vi.fn() }))
vi.mock('../../api/fx', () => ({ fetchFxRate: vi.fn() }))
vi.mock('../news/NewsEventsPanel', () => ({ default: () => <span>Calendar coverage</span> }))
vi.mock('./BriefingPanel', () => ({ BriefingPanel: () => null }))
const selected = { id: 's1', name: 'My strategy', entryConditions: ['Sweep', 'Retest'], archived: false } as any
let lastDraft: SessionReview
function Harness() {
  const [draft, setDraft] = useState<SessionReview>({ ...emptyReview, strategyId: 's1', preparation: { ...initialPreparation(), bias: 'bullish' } })
  lastDraft = draft
  return <PrepareSteps date="2026-10-05" draft={draft} update={patch => setDraft(d => ({ ...d, ...patch }))} strategies={[selected]} mentorStrategies={[]} reloadStrategies={() => {}} start={() => {}} saving={false} chart={<div>Chart stays visible</div>} userId="u1" accountId="a1" accountLabel="Personal" accountCurrency="EUR" isCurrentDate session="DAY" symbol="DAX" market="CFD" direction="LONG" maximumPermittedRisk={250} />
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
it('persists feelings, checks, notes and scoped risk and transfers the latest edits as one complete snapshot', async () => {
  vi.mocked(getSessionWorkspace).mockResolvedValue({ session: { id: 'session-1' } } as any)
  vi.mocked(createSetupCandidate).mockResolvedValue({ setups: [] } as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><I18nProvider><Harness /></I18nProvider></QueryClientProvider></MemoryRouter>)
  fireEvent.click(screen.getByText(/Psychology ·/))
  fireEvent.click(screen.getByRole('button', { name: 'Focused' }))
  fireEvent.click(screen.getByLabelText('Chasing price'))
  fireEvent.change(screen.getByLabelText('Psychology notes'), { target: { value: 'Pressure noted; waited for confirmation.' } })
  fireEvent.click(screen.getByText('Session notes', { selector: 'summary' }))
  fireEvent.change(screen.getByLabelText('Session notes'), { target: { value: 'Notițe editate chiar înainte de logare.' } })
  fireEvent.click(screen.getByLabelText('Sweep'))
  fireEvent.change(screen.getByLabelText('My session thesis'), { target: { value: 'Latest thesis' } })
  fireEvent.change(screen.getByLabelText('Chart plan, invalidation and target'), { target: { value: 'Latest chart plan' } })
  for (const [label, value] of [['Intended risk','200'], ['Entry price','24000'], ['Stop loss','23990'], ['Take profit','24020'], ['Quantity','2'], ['Invalidation','Close below swept low']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  expect(lastDraft.preparation).toMatchObject({ emotion: 'focused', discipline: { chasing: true }, checklist: [true], checklistLabels: ['Sweep','Retest'], psychologyNotes: 'Pressure noted; waited for confirmation.', sessionNotes: 'Notițe editate chiar înainte de logare.', riskDrafts: { 'CFD:DAX': { intendedRiskAmount: '200', manualQuantity: '2' } } })
  fireEvent.click(screen.getByRole('button', { name: 'Review execution draft' }))
  await waitFor(() => expect(createSetupCandidate).toHaveBeenCalledOnce())
  const payload = vi.mocked(createSetupCandidate).mock.calls[0][1]
  expect(payload.context?.preparationSnapshot).toMatchObject({ accountId: 'a1', date: '2026-10-05', session: 'DAY', review: { focus: 'Latest thesis', preparation: { chartPlan: 'Latest chart plan', emotion: 'focused', psychologyNotes: 'Pressure noted; waited for confirmation.' } }, strategyDefinition: selected, risk: { intendedRiskAmount: 200, quantity: 2, invalidation: 'Close below swept low', entryPrice: 24000 }, capacity: { maximumPermittedRisk: 250 } })
  expect(payload.execution?.tickets?.[0]).toMatchObject({ riskAmount: 200, quantity: 2 })
})
