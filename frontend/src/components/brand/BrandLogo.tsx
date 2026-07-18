import { useId } from 'react'
import { useTheme } from '@mui/material'

export type BrandLogoVariant = 'auto' | 'light' | 'dark'
export type BrandLogoLayout = 'horizontal' | 'mark'
export type BrandLogoSize = 'sm' | 'md' | 'lg'

type BrandLogoProps = {
  variant?: BrandLogoVariant
  layout?: BrandLogoLayout
  size?: BrandLogoSize
  label?: string
  decorative?: boolean
  className?: string
}

const logoHeights: Record<BrandLogoSize, number> = {
  sm: 28,
  md: 34,
  lg: 52
}

const brandWordmark = {
  prefix: 'Trade',
  suffix: 'JAudit'
} as const

export default function BrandLogo({
  variant = 'auto',
  layout = 'horizontal',
  size = 'md',
  label = 'TradeJAudit',
  decorative = false,
  className
}: BrandLogoProps) {
  const theme = useTheme()
  const gradientId = `tradejaudit-accent-${useId().replace(/:/g, '')}`
  const surfaceMode = variant === 'auto' ? theme.palette.mode : variant
  const foreground = surfaceMode === 'dark' ? '#f5f8ff' : '#10213a'
  const shield = surfaceMode === 'dark' ? '#162945' : '#10213a'
  const accentStart = theme.palette.primary.main
  const accentEnd = theme.palette.secondary.main
  const height = logoHeights[size]
  const horizontal = layout === 'horizontal'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={horizontal ? '0 0 260 56' : '0 0 60 56'}
      width={horizontal ? Math.round(height * (260 / 56)) : Math.round(height * (60 / 56))}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      focusable="false"
      className={className}
      data-testid="brand-logo"
      data-layout={layout}
      data-variant={surfaceMode}
      style={{ display: 'block', flexShrink: 0, maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="7" y1="4" x2="52" y2="53" gradientUnits="userSpaceOnUse">
          <stop stopColor={accentStart} />
          <stop offset="1" stopColor={accentEnd} />
        </linearGradient>
      </defs>

      <g aria-hidden="true">
        <path
          d="M5 3h34v9h13v21.5c0 10-7.7 17.5-23.5 22.5C12.7 51 5 43.5 5 33.5V3Z"
          fill={shield}
        />
        <path
          d="M5 3h34v9H17v22c0 5.9 3.8 10.8 11.5 14.1 7.7-3.3 11.5-8.2 11.5-14.1V20h12v13.5c0 10-7.7 17.5-23.5 22.5C12.7 51 5 43.5 5 33.5V3Z"
          fill={`url(#${gradientId})`}
        />
        <path d="M12 28v10M18 21v17M24 15v23" stroke="#f8fbff" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M9.5 31h5M15.5 25h5M21.5 19h5" stroke="#f8fbff" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M31 17h8v18.5c0 5.2-2.7 8.1-7.6 8.1-2.2 0-4.1-.7-5.7-2" fill="none" stroke="#f8fbff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {horizontal && (
        <text
          x="66"
          y="36"
          fontFamily="'Plus Jakarta Sans', 'Manrope', Arial, sans-serif"
          fontSize="27"
          fontWeight="800"
          letterSpacing="-0.8"
          aria-hidden="true"
        >
          <tspan fill={foreground}>{brandWordmark.prefix}</tspan>
          <tspan fill={`url(#${gradientId})`}>{brandWordmark.suffix}</tspan>
        </text>
      )}
    </svg>
  )
}
