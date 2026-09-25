import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import EventDetails from './EventDetails'
import { I18nProvider, useI18n } from '../../i18n'
import type { BriefingEvent } from './model'
const event: BriefingEvent = { id: 'official', name: 'Official statistic', source: 'BLS', sourceUrl: 'https://www.bls.gov/', region: 'US', timezone: 'America/New_York',
 scheduledAt: '2026-09-25T12:30:00Z', publishedAt: '2026-09-25T12:30:00Z', actual: '4.1', unit: '%', status: 'RELEASED', official: {
 sourceId: 'BLS', eventId: 'event', sourceEventId: 'source-event', identityBasis: 'SOURCE_UID', revisionId: '12345678-1234-4234-8234-123456789abc', retrievedAt: '2026-09-25T12:35:00Z'
 } }
function Content() {
 const { setLanguage } = useI18n()
 return <><button onClick={() => setLanguage('en')}>EN</button><button onClick={() => setLanguage('ro')}>RO</button><EventDetails event={event} referenceTime="2026-09-25T13:00:00Z" displayTimezone="Atlantic/Canary" /></>
}
afterEach(cleanup)
describe('event locale parity', () => {
 it('retains original source timezone while displaying local times and unavailability in both languages', () => {
   const { container } = render(<I18nProvider><Content /></I18nProvider>)
   fireEvent.click(screen.getByRole('button', { name: 'EN' }))
   expect(screen.getByText(/Source timezone: America\/New_York/)).toBeInTheDocument()
   expect(screen.getByText('Forecast / consensus: Unavailable')).toBeInTheDocument()
   expect(container.querySelector('time[datetime="2026-09-25T12:30:00Z"]')).toHaveTextContent(/1:30:00 PM.*Atlantic\/Canary/)
   expect(screen.getByText(/Retrieved:/)).toHaveTextContent('Atlantic/Canary')
   fireEvent.click(screen.getByRole('button', { name: 'RO' }))
   expect(screen.getByText(/Fusul orar al sursei: America\/New_York/)).toBeInTheDocument()
   expect(screen.getByText('Prognoză / consens: Indisponibil')).toBeInTheDocument()
   expect(container.querySelector('time[datetime="2026-09-25T12:30:00Z"]')).toHaveTextContent(/13:30:00.*Atlantic\/Canary/)
   expect(container.textContent).not.toMatch(/workstation\.|officialEvents\./)
 })
})
