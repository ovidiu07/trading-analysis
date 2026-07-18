import { RefObject, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

type RouteViewportResetOptions = {
  scrollContainerRef?: RefObject<HTMLElement>
  onRouteChange?: () => void
}

export default function useRouteViewportReset({
  scrollContainerRef,
  onRouteChange
}: RouteViewportResetOptions = {}) {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    onRouteChange?.()

    const main = scrollContainerRef?.current
    const preserveAnchorPosition = Boolean(hash)

    document.documentElement.scrollLeft = 0
    document.body.scrollLeft = 0

    if (main) {
      main.scrollLeft = 0
      if (!preserveAnchorPosition) {
        main.scrollTop = 0
      }
    }

    window.scrollTo({
      top: preserveAnchorPosition ? window.scrollY : 0,
      left: 0,
      behavior: 'auto'
    })

    if (hash) {
      const anchorId = decodeURIComponent(hash.slice(1))
      document.getElementById(anchorId)?.scrollIntoView()
    }
  }, [hash, onRouteChange, pathname, scrollContainerRef])
}
