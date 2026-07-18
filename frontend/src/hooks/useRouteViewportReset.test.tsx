import '@testing-library/jest-dom/vitest'
import { useRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useRouteViewportReset from './useRouteViewportReset'

function RouteResetHarness({ onRouteChange }: { onRouteChange: () => void }) {
  const mainRef = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()
  useRouteViewportReset({ scrollContainerRef: mainRef, onRouteChange })

  return (
    <>
      <button onClick={() => navigate('/next')}>Next route</button>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
      <main ref={mainRef} data-testid="main-scroll-container" />
    </>
  )
}

describe('useRouteViewportReset', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
  })

  it('resets horizontal and vertical positions on route, back, and forward navigation', async () => {
    const onRouteChange = vi.fn()
    render(
      <MemoryRouter initialEntries={['/start']}>
        <RouteResetHarness onRouteChange={onRouteChange} />
      </MemoryRouter>
    )

    const main = screen.getByTestId('main-scroll-container')
    const assertResetAfter = async (action: () => void) => {
      document.documentElement.scrollLeft = 18
      document.body.scrollLeft = 14
      main.scrollLeft = 12
      main.scrollTop = 90
      action()

      await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' }))
      expect(document.documentElement.scrollLeft).toBe(0)
      expect(document.body.scrollLeft).toBe(0)
      expect(main.scrollLeft).toBe(0)
      expect(main.scrollTop).toBe(0)
    }

    await assertResetAfter(() => fireEvent.click(screen.getByRole('button', { name: 'Next route' })))
    await assertResetAfter(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })))
    await assertResetAfter(() => fireEvent.click(screen.getByRole('button', { name: 'Forward' })))
    expect(onRouteChange).toHaveBeenCalledTimes(4)
  })
})
