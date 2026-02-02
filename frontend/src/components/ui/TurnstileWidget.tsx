import { Box } from '@mui/material'
import { useEffect, useRef } from 'react'

type TurnstileWidgetProps = {
  siteKey: string
  onSuccess: (token: string) => void
  onError: () => void
  onExpire: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

export default function TurnstileWidget({ siteKey, onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onSuccess,
        'error-callback': onError,
        'expired-callback': onExpire
      })
    }

    if (window.turnstile) {
      renderWidget()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = renderWidget
    document.body.appendChild(script)

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [onError, onExpire, onSuccess, siteKey])

  return <Box ref={containerRef} />
}
