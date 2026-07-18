export type ViewportOverflowElement = {
  tag: string
  id: string
  className: string
  left: number
  right: number
  width: number
}

export type ViewportOverflowReport = {
  viewportWidth: number
  documentWidth: number
  bodyWidth: number
  mainWidth: number | null
  hasOverflow: boolean
  offenders: ViewportOverflowElement[]
}

export function collectViewportOverflow(
  doc: Document = document,
  viewportWidth: number = window.innerWidth,
  tolerance = 1
): ViewportOverflowReport {
  const main = doc.querySelector<HTMLElement>('main')

  const isContainedByOverflowRegion = (element: HTMLElement) => {
    let parent = element.parentElement
    while (parent && parent !== doc.body) {
      const style = window.getComputedStyle(parent)
      if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
        const rect = parent.getBoundingClientRect()
        if (rect.left >= -tolerance && rect.right <= viewportWidth + tolerance) {
          return true
        }
      }
      parent = parent.parentElement
    }
    return false
  }

  const offenders = Array.from(doc.querySelectorAll<HTMLElement>('*'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      if (
        style.display === 'none'
        || style.visibility === 'hidden'
        || element.closest('[aria-hidden="true"]')
        || isContainedByOverflowRegion(element)
      ) {
        return null
      }
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: String(element.className || '').slice(0, 160),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10
      }
    })
    .filter((element): element is ViewportOverflowElement => Boolean(
      element
      && element.width > 0
      && (element.left < -tolerance || element.right > viewportWidth + tolerance)
    ))
    .slice(0, 20)

  const documentWidth = doc.documentElement.scrollWidth
  const bodyWidth = doc.body.scrollWidth
  const mainWidth = main?.scrollWidth ?? null
  const hasOverflow = documentWidth > viewportWidth + tolerance
    || bodyWidth > viewportWidth + tolerance
    || (mainWidth !== null && mainWidth > viewportWidth + tolerance)

  return {
    viewportWidth,
    documentWidth,
    bodyWidth,
    mainWidth,
    hasOverflow,
    offenders
  }
}
