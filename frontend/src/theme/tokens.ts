export type AppThemeMode = 'light' | 'dark' | 'black-shiny'

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
  sm: 14,
  md: 18,
  lg: 24,
  pill: 999
}

const lightTokens: DesignTokens = {
  radius: sharedRadius,
  elevation: {
    card: '0 1px 2px rgba(9, 20, 38, 0.05), 0 20px 44px rgba(9, 20, 38, 0.1)',
    floating: '0 12px 28px rgba(9, 20, 38, 0.18)'
  },
  surface: {
    app: '#eef3fb',
    background: '#f6f9ff',
    panel: 'rgba(255, 255, 255, 0.92)',
    panelMuted: '#e9f0fb',
    sidebar: 'rgba(252, 254, 255, 0.9)',
    header: 'rgba(246, 250, 255, 0.82)'
  },
  text: {
    primary: '#0f1a2f',
    secondary: '#34445f',
    muted: '#5f7190',
    disabled: '#95a7c1',
    inverse: '#f7fbff'
  },
  border: {
    subtle: 'rgba(31, 56, 98, 0.18)',
    strong: 'rgba(31, 56, 98, 0.32)',
    focus: '#2f73e8'
  },
  brand: {
    primary: '#1f63dd',
    primaryStrong: '#1749ad',
    primarySoft: '#d7e6ff',
    secondary: '#0d9384',
    secondarySoft: '#d3f4ef',
    gradientStart: '#2568e4',
    gradientEnd: '#13b59e'
  },
  feedback: {
    success: '#0f9050',
    warning: '#b67610',
    error: '#c63a4d',
    info: '#2f6fe9'
  },
  chart: {
    grid: 'rgba(41, 66, 105, 0.2)',
    axis: '#4a5f7f',
    positive: '#11965a',
    negative: '#d14758'
  },
  interaction: {
    hover: 'rgba(31, 99, 221, 0.09)',
    selected: 'rgba(31, 99, 221, 0.16)',
    pressed: 'rgba(31, 99, 221, 0.24)'
  }
}

const darkTokens: DesignTokens = {
  radius: sharedRadius,
  elevation: {
    card: '0 1px 1px rgba(0, 0, 0, 0.45), 0 20px 50px rgba(0, 0, 0, 0.58)',
    floating: '0 18px 42px rgba(0, 0, 0, 0.7)'
  },
  surface: {
    app: '#050c18',
    background: '#091222',
    panel: 'rgba(16, 29, 48, 0.9)',
    panelMuted: '#162842',
    sidebar: 'rgba(9, 21, 35, 0.9)',
    header: 'rgba(7, 17, 31, 0.8)'
  },
  text: {
    primary: '#ecf3ff',
    secondary: '#bccbe0',
    muted: '#8ca3c2',
    disabled: '#6f87a9',
    inverse: '#081221'
  },
  border: {
    subtle: 'rgba(132, 164, 214, 0.28)',
    strong: 'rgba(132, 164, 214, 0.46)',
    focus: '#8abcfb'
  },
  brand: {
    primary: '#74b1ff',
    primaryStrong: '#4589f0',
    primarySoft: 'rgba(116, 177, 255, 0.22)',
    secondary: '#54d8c2',
    secondarySoft: 'rgba(84, 216, 194, 0.23)',
    gradientStart: '#71aef8',
    gradientEnd: '#4fd6bc'
  },
  feedback: {
    success: '#3dca8e',
    warning: '#efbb5e',
    error: '#ef7a86',
    info: '#93c9ff'
  },
  chart: {
    grid: 'rgba(148, 173, 213, 0.26)',
    axis: '#b1c4e0',
    positive: '#41cc93',
    negative: '#f08e99'
  },
  interaction: {
    hover: 'rgba(116, 177, 255, 0.16)',
    selected: 'rgba(116, 177, 255, 0.27)',
    pressed: 'rgba(116, 177, 255, 0.35)'
  }
}

const blackShinyTokens: DesignTokens = {
  radius: sharedRadius,
  elevation: {
    card: '0 1px 1px rgba(0, 0, 0, 0.72), 0 24px 54px rgba(0, 0, 0, 0.86)',
    floating: '0 24px 58px rgba(0, 0, 0, 0.92)'
  },
  surface: {
    app: '#020202',
    background: '#060606',
    panel: 'rgba(15, 15, 15, 0.86)',
    panelMuted: 'rgba(20, 20, 20, 0.92)',
    sidebar: 'rgba(7, 7, 7, 0.88)',
    header: 'rgba(6, 6, 6, 0.82)'
  },
  text: {
    primary: '#f5f7fb',
    secondary: '#c3cada',
    muted: '#9ca9c5',
    disabled: '#67718a',
    inverse: '#050506'
  },
  border: {
    subtle: 'rgba(173, 186, 212, 0.3)',
    strong: 'rgba(173, 186, 212, 0.46)',
    focus: '#7dd3ff'
  },
  brand: {
    primary: '#2ed2ff',
    primaryStrong: '#06b9e9',
    primarySoft: 'rgba(46, 210, 255, 0.2)',
    secondary: '#8ca6ff',
    secondarySoft: 'rgba(140, 166, 255, 0.2)',
    gradientStart: '#35dcff',
    gradientEnd: '#7d8dff'
  },
  feedback: {
    success: '#3fd89e',
    warning: '#f6bf63',
    error: '#ff8b94',
    info: '#7dd3ff'
  },
  chart: {
    grid: 'rgba(166, 181, 210, 0.28)',
    axis: '#b8c5df',
    positive: '#44d9a2',
    negative: '#ff98a0'
  },
  interaction: {
    hover: 'rgba(46, 210, 255, 0.18)',
    selected: 'rgba(46, 210, 255, 0.28)',
    pressed: 'rgba(46, 210, 255, 0.4)'
  }
}

export const getDesignTokens = (mode: AppThemeMode): DesignTokens =>
  mode === 'light'
    ? lightTokens
    : mode === 'black-shiny'
      ? blackShinyTokens
      : darkTokens
