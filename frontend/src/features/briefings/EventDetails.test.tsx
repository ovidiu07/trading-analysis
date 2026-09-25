import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventDetails from './EventDetails'
import { canShowEventActual, type BriefingEvent } from './model'

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en-GB' }) }))
afterEach(cleanup)
const event: BriefingEvent = { id: 'release', name: 'Official result', region: 'EU', timezone: 'Europe/Luxembourg',
 source: 'Eurostat', sourceUrl: 'https://ec.europa.eu/eurostat/', status: 'RELEASED', actual: '6.1', unit: '%',
 scheduledAt: '2026-09-01T09:00:00Z', publishedAt: '2026-09-01T09:00:00Z' }
describe('official event display', () => {
 it('never reveals a future or unknown publication, even when status says released', () => {
   const now = Date.parse('2026-09-01T09:00:00Z')
   expect(canShowEventActual(event, undefined, now)).toBe(true)
   expect(canShowEventActual(event, undefined, now - 1)).toBe(false)
   expect(canShowEventActual({ ...event, publishedAt: null }, undefined, now)).toBe(false)
   expect(canShowEventActual({ ...event, status: 'CANCELLED' }, undefined, now)).toBe(false)
   expect(canShowEventActual(event, '2026-09-01T08:59:59Z', now)).toBe(false)
 })
 it('renders date-only schedules without inventing an instant or consensus', () => {
   render(<EventDetails event={{ ...event, scheduledAt: null, scheduledDate: '2026-09-01', publishedAt: null, forecast: 'invented' }} />)
   expect(screen.getByText(/officialEvents.timeUnavailable/)).toBeInTheDocument()
   expect(screen.queryByText(/6.1/)).not.toBeInTheDocument()
   expect(screen.queryByText(/invented/)).not.toBeInTheDocument()
   expect(screen.getByText(/workstation.eventForecast: workstation.unavailable/)).toBeInTheDocument()
 })
 it('labels released values with units and the official publication time', () => {
   render(<EventDetails event={event} referenceTime="2026-09-01T10:00:00Z" />)
   expect(screen.getByText('workstation.eventActual: 6.1 %')).toBeInTheDocument()
   expect(screen.getAllByTitle('2026-09-01T09:00:00Z')[1]).toHaveAttribute('datetime', '2026-09-01T09:00:00Z')
   expect(screen.getByRole('link', { name: 'Eurostat' })).toHaveAttribute('href', event.sourceUrl)
 })
})
