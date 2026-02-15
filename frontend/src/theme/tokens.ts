export type AppThemeMode = 'light' | 'dark'

type ElevationTokens = {
  card: string
  floating: string
}

type RadiusTokens = {
  xs: number
  sm: number
  md: number
  lg: number
  pill: number
}

type SurfaceTokens = {
  app: string
  background: string
  panel: string
  panelMuted: string
  sidebar: string
  header: string
}

type TextTokens = {
  primary: string
  secondary: string
  muted: string
  disabled: string
  inverse: string
}

type BorderTokens = {
  subtle: string
  strong: string
  focus: string
}

type BrandTokens = {
  primary: string
  primaryStrong: string
  primarySoft: string
  secondary: string
  secondarySoft: string
  gradientStart: string
  gradientEnd: string
}

type FeedbackTokens = {
  success: string
  warning: string
  error: string
  info: string
}

type ChartTokens = {
  grid: string
  axis: string
  positive: string
  negative: string
}

type InteractionTokens = {
  hover: string
  selected: string
  pressed: string
}

export type DesignTokens = {
  radius: RadiusTokens
  elevation: ElevationTokens
  surface: SurfaceTokens
  text: TextTokens
  border: BorderTokens
  brand: BrandTokens
  feedback: FeedbackTokens
  chart: ChartTokens
  interaction: InteractionTokens
}

const sharedRadius: RadiusTokens = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  pill: 999
}

const lightTokens: DesignTokens = {
  radius: sharedRadius,
  elevation: {
    card: '0 1px 2px rgba(11, 17, 32, 0.04), 0 16px 40px rgba(11, 17, 32, 0.07)',
    floating: '0 8px 24px rgba(11, 17, 32, 0.14)'
  },
  surface: {
    app: '#f4f7fc',
    background: '#f8fbff',
    panel: '#ffffff',
    panelMuted: '#eef3fb',
    sidebar: '#fbfdff',
    header: 'rgba(248, 251, 255, 0.86)'
  },
  text: {
    primary: '#0f1728',
    secondary: '#37455c',
    muted: '#607089',
    disabled: '#9aa8be',
    inverse: '#f7fbff'
  },
  border: {
    subtle: 'rgba(33, 57, 98, 0.14)',
    strong: 'rgba(33, 57, 98, 0.26)',
    focus: '#2f6df6'
  },
  brand: {
    primary: '#2458d5',
    primaryStrong: '#183f9e',
    primarySoft: '#dfe9ff',
    secondary: '#0f8d81',
    secondarySoft: '#d8f5f2',
    gradientStart: '#2f6df6',
    gradientEnd: '#11b9a0'
  },
  feedback: {
    success: '#0f8a47',
    warning: '#b7730f',
    error: '#c33245',
    info: '#2d67e6'
  },
  chart: {
    grid: 'rgba(43, 69, 110, 0.18)',
    axis: '#4d5f7a',
    positive: '#0f8a47',
    negative: '#cc3b4d'
  },
  interaction: {
    hover: 'rgba(36, 88, 213, 0.08)',
    selected: 'rgba(36, 88, 213, 0.14)',
    pressed: 'rgba(36, 88, 213, 0.2)'
  }
}

const darkTokens: DesignTokens = {
  radius: sharedRadius,
  elevation: {
    card: '0 1px 1px rgba(0, 0, 0, 0.4), 0 18px 44px rgba(0, 0, 0, 0.5)',
    floating: '0 16px 38px rgba(0, 0, 0, 0.65)'
  },
  surface: {
    app: '#050a14',
    background: '#0a1220',
    panel: '#121d31',
    panelMuted: '#18263f',
    sidebar: '#0d182a',
    header: 'rgba(8, 16, 30, 0.84)'
  },
  text: {
    primary: '#eef4ff',
    secondary: '#becbdf',
    muted: '#8da2bf',
    disabled: '#6f85a5',
    inverse: '#081221'
  },
  border: {
    subtle: 'rgba(128, 159, 211, 0.24)',
    strong: 'rgba(128, 159, 211, 0.44)',
    focus: '#7ab3ff'
  },
  brand: {
    primary: '#6ca8ff',
    primaryStrong: '#3f80e6',
    primarySoft: 'rgba(108, 168, 255, 0.2)',
    secondary: '#4fd4bf',
    secondarySoft: 'rgba(79, 212, 191, 0.2)',
    gradientStart: '#6ca8ff',
    gradientEnd: '#4fd4bf'
  },
  feedback: {
    success: '#39c889',
    warning: '#f2ba59',
    error: '#f17580',
    info: '#8cc5ff'
  },
  chart: {
    grid: 'rgba(145, 169, 208, 0.24)',
    axis: '#aec0db',
    positive: '#39c889',
    negative: '#f08a94'
  },
  interaction: {
    hover: 'rgba(108, 168, 255, 0.14)',
    selected: 'rgba(108, 168, 255, 0.24)',
    pressed: 'rgba(108, 168, 255, 0.32)'
  }
}

export const getDesignTokens = (mode: AppThemeMode): DesignTokens =>
  mode === 'light' ? lightTokens : darkTokens
