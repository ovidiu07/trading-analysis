import { describe, expect, it } from 'vitest'
import { collectViewportOverflow } from './viewportDiagnostics'

describe('collectViewportOverflow', () => {
  it('reports the document, main scroller, and the widest visible offender', () => {
    document.body.innerHTML = '<main><div id="wide-element"></div></main>'
    const wideElement = document.getElementById('wide-element') as HTMLElement
    wideElement.getBoundingClientRect = () => ({
      x: 8,
      y: 0,
      left: 8,
      right: 342,
      top: 0,
      bottom: 40,
      width: 334,
      height: 40,
      toJSON: () => ({})
    })
    Object.defineProperty(document.documentElement, 'scrollWidth', { configurable: true, value: 342 })
    Object.defineProperty(document.body, 'scrollWidth', { configurable: true, value: 342 })
    Object.defineProperty(document.querySelector('main'), 'scrollWidth', { configurable: true, value: 342 })

    const report = collectViewportOverflow(document, 320)

    expect(report.hasOverflow).toBe(true)
    expect(report.mainWidth).toBe(342)
    expect(report.offenders).toEqual([
      expect.objectContaining({ id: 'wide-element', right: 342, width: 334 })
    ])
  })
})
