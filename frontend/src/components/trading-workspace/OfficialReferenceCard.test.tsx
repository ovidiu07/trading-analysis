import '@testing-library/jest-dom/vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {I18nProvider} from '../../i18n'
import OfficialReferenceCard from './OfficialReferenceCard'
vi.mock('../../api/client',()=>({apiGet:vi.fn()}))
afterEach(()=>{cleanup();localStorage.clear()})
const row={canonicalInstrument:'ECB_EUR_USD',provider:'ECB',providerSymbol:'USD',priceBasis:'OFFICIAL_DAILY_REFERENCE',value:1.17,unit:'USD per EUR',observationDate:'2026-09-25',retrievedAt:'2026-09-25T15:00:00Z',freshness:'CLOSE',provenance:'OFFICIAL_PUBLIC'}
function show(data:unknown){const client=new QueryClient();client.setQueryData(['officialDailyReferences'],data);render(<QueryClientProvider client={client}><I18nProvider><OfficialReferenceCard timezone="Europe/Bucharest"/></I18nProvider></QueryClientProvider>)}
it('shows attributed daily references and their observation date, never live',()=>{show([row]);expect(screen.getByText('1 EUR = 1.17 USD')).toBeInTheDocument();expect(screen.getByText(/2026-09-25/)).toBeInTheDocument();expect(screen.getByRole('link')).toHaveAttribute('href','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html');expect(screen.queryByText('Live')).not.toBeInTheDocument()})
it('does not display a substituted symbol or nonofficial provenance',()=>{show([{...row,providerSymbol:'EUR_USD'},{...row,provenance:'USER_CONNECTED'}]);expect(screen.queryByText(/1\.17/)).not.toBeInTheDocument()})
it('retains a daily observation explicitly stale after upstream failure',()=>{show([{...row,freshness:'STALE',availabilityReason:'UPSTREAM_ERROR'}]);expect(screen.getByText('1 EUR = 1.17 USD')).toBeInTheDocument();expect(screen.getByText(/Stale/)).toBeInTheDocument();expect(screen.getByText('Provider is temporarily unavailable')).toBeInTheDocument()})
