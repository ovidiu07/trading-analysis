import { alpha, createTheme } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'

type AppThemeMode = 'light' | 'dark'

type AppThemeTokens = {
  radius: {
    card: number
    input: number
  }
  shadows: {
    card: string
  }
  colors: {
    background: string
    surface: string
    surfaceRaised: string
    appBar: string
    sidebar: string
    border: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    textDisabled: string
    link: string
    linkHover: string
    accent: string
    accentStrong: string
    accentContrast: string
    positive: string
    negative: string
    warning: string
    chartGrid: string
    chartAxis: string
    tooltip: string
  }
}

declare module '@mui/material/styles' {
  interface Palette {
    chart: {
      grid: string
      axis: string
    }
  }

  interface PaletteOptions {
    chart?: {
      grid: string
      axis: string
    }
  }
}

const buildThemeTokens = (mode: AppThemeMode): AppThemeTokens => {
  if (mode === 'light') {
    return {
      radius: {
        card: 14,
        input: 10
      },
      shadows: {
        card: '0 0 0 1px rgba(15, 23, 42, 0.06), 0 10px 26px rgba(15, 23, 42, 0.08)'
      },
      colors: {
        background: '#f4f7fb',
        surface: '#ffffff',
        surfaceRaised: '#f0f4fa',
        appBar: 'rgba(255, 255, 255, 0.94)',
        sidebar: '#f8fbff',
        border: '#d0d9e8',
        textPrimary: '#111317',
        textSecondary: '#2f3b4b',
        textMuted: '#5f6e82',
        textDisabled: '#8a97aa',
        link: '#1b5ee4',
        linkHover: '#154cc0',
        accent: '#1b5ee4',
        accentStrong: '#1147b7',
        accentContrast: '#ffffff',
        positive: '#0d8e50',
        negative: '#c6343c',
        warning: '#ad680f',
        chartGrid: '#d6dfec',
        chartAxis: '#4e5f78',
        tooltip: '#ffffff'
      }
    }
  }

  return {
    radius: {
      card: 14,
      input: 10
    },
    shadows: {
      card: '0 0 0 1px rgba(0, 0, 0, 0.18), 0 12px 26px rgba(0, 0, 0, 0.34)'
    },
    colors: {
      background: '#060b12',
      surface: '#101927',
      surfaceRaised: '#172438',
      appBar: 'rgba(11, 19, 32, 0.92)',
      sidebar: '#0c1624',
      border: '#2d3f56',
      textPrimary: '#eef4ff',
      textSecondary: '#b6c3d8',
      textMuted: '#95a5bd',
      textDisabled: '#7385a1',
      link: '#7fc1ff',
      linkHover: '#b2daff',
      accent: '#45a3ff',
      accentStrong: '#2b87e0',
      accentContrast: '#041525',
      positive: '#2ac17c',
      negative: '#ef6e6e',
      warning: '#f4ae45',
      chartGrid: '#2a3b52',
      chartAxis: '#b3c0d5',
      tooltip: '#0d1522'
    }
  }
}

const buildAppTheme = (mode: AppThemeMode): Theme => {
  const tokens = buildThemeTokens(mode)
  const isLight = mode === 'light'

  return createTheme({
    spacing: 8,
    shape: {
      borderRadius: tokens.radius.card
    },
    palette: {
      mode,
      primary: {
        main: tokens.colors.accent,
        light: alpha(tokens.colors.accent, 0.8),
        dark: tokens.colors.accentStrong,
        contrastText: tokens.colors.accentContrast
      },
      secondary: {
        main: isLight ? '#0f766e' : '#63b2ff'
      },
      success: {
        main: tokens.colors.positive,
        light: alpha(tokens.colors.positive, isLight ? 0.22 : 0.24)
      },
      error: {
        main: tokens.colors.negative,
        light: alpha(tokens.colors.negative, isLight ? 0.2 : 0.24)
      },
      warning: {
        main: tokens.colors.warning
      },
      info: {
        main: tokens.colors.link
      },
      background: {
        default: tokens.colors.background,
        paper: tokens.colors.surface
      },
      text: {
        primary: tokens.colors.textPrimary,
        secondary: tokens.colors.textSecondary,
        disabled: tokens.colors.textDisabled
      },
      divider: alpha(tokens.colors.border, isLight ? 0.95 : 0.9),
      action: {
        hover: isLight ? alpha(tokens.colors.accent, 0.08) : alpha('#ffffff', 0.08),
        selected: alpha(tokens.colors.accent, isLight ? 0.14 : 0.26),
        focus: alpha(tokens.colors.accent, isLight ? 0.22 : 0.34),
        disabled: alpha(tokens.colors.textDisabled, 0.72),
        disabledBackground: alpha(tokens.colors.surfaceRaised, 0.7)
      },
      chart: {
        grid: tokens.colors.chartGrid,
        axis: tokens.colors.chartAxis
      }
    },
    typography: {
      fontFamily: '"Inter", "Manrope", "IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: 15,
      h1: { fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.3 },
      h2: { fontSize: 24, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.2 },
      h3: { fontSize: 20, fontWeight: 700, lineHeight: 1.3 },
      h4: { fontSize: 18, fontWeight: 700, lineHeight: 1.35 },
      h5: { fontSize: 16, fontWeight: 700, lineHeight: 1.4 },
      h6: { fontSize: 15, fontWeight: 650, lineHeight: 1.4 },
      subtitle1: { fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
      subtitle2: { fontSize: 13, fontWeight: 600, lineHeight: 1.45 },
      body1: { fontSize: 15, lineHeight: 1.55 },
      body2: { fontSize: 14, lineHeight: 1.5 },
      caption: { fontSize: 12, lineHeight: 1.45 },
      button: { fontSize: 14, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.1 }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--app-font-mono': '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace'
          },
          '*, *::before, *::after': {
            boxSizing: 'border-box'
          },
          ':focus-visible': {
            outline: `2px solid ${alpha(tokens.colors.accent, 0.95)}`,
            outlineOffset: 2
          },
          html: {
            width: '100%',
            maxWidth: '100%',
            overflowX: 'clip'
          },
          body: {
            width: '100%',
            maxWidth: '100%',
            overflowX: 'clip',
            margin: 0,
            color: tokens.colors.textPrimary,
            background: isLight
              ? `radial-gradient(circle at 16% 0%, ${alpha('#93b5e5', 0.2)} 0%, ${tokens.colors.background} 55%)`
              : `radial-gradient(circle at 20% 0%, ${alpha('#1c2f4b', 0.35)} 0%, ${tokens.colors.background} 55%)`
          },
          '#root': {
            width: '100%',
            maxWidth: '100%',
            minHeight: '100%',
            overflowX: 'clip'
          },
          'img, video, canvas': {
            maxWidth: '100%',
            height: 'auto'
          },
          a: {
            color: tokens.colors.link,
            textDecorationColor: alpha(tokens.colors.link, 0.8),
            '&:hover': {
              color: tokens.colors.linkHover
            }
          },
          '.metric-value': {
            fontFamily: 'var(--app-font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum"',
            letterSpacing: -0.25
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            color: tokens.colors.textPrimary,
            background: tokens.colors.appBar,
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${alpha(tokens.colors.border, 0.95)}`
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: tokens.colors.sidebar,
            color: tokens.colors.textPrimary,
            borderRight: `1px solid ${alpha(tokens.colors.border, 0.95)}`
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            borderRadius: tokens.radius.card,
            border: `1px solid ${alpha(tokens.colors.border, 0.85)}`
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.card,
            border: `1px solid ${alpha(tokens.colors.border, 0.85)}`,
            backgroundColor: tokens.colors.surface,
            boxShadow: tokens.shadows.card
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.input,
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 40
          },
          text: {
            color: tokens.colors.link,
            '&:hover': {
              backgroundColor: alpha(tokens.colors.link, 0.12),
              color: tokens.colors.linkHover
            }
          }
        }
      },
      MuiLink: {
        styleOverrides: {
          root: {
            color: tokens.colors.link,
            textDecorationColor: alpha(tokens.colors.link, 0.8),
            '&:hover': {
              color: tokens.colors.linkHover
            }
          }
        }
      },
      MuiFormControl: {
        defaultProps: {
          size: 'small',
          variant: 'outlined'
        }
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined'
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            color: tokens.colors.textPrimary
          },
          input: {
            fontSize: '0.95rem',
            lineHeight: 1.45,
            '&::placeholder': {
              color: alpha(tokens.colors.textMuted, 0.92)
            },
            '&:-webkit-autofill': {
              WebkitTextFillColor: tokens.colors.textPrimary,
              WebkitBoxShadow: `0 0 0 100px ${tokens.colors.surfaceRaised} inset`,
              transition: 'background-color 9999s ease-in-out 0s'
            },
            '&.Mui-disabled': {
              WebkitTextFillColor: tokens.colors.textMuted,
              color: tokens.colors.textMuted
            }
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: tokens.colors.surfaceRaised,
            borderRadius: tokens.radius.input,
            minHeight: 40,
            [theme.breakpoints.down('sm')]: {
              minHeight: 44
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(tokens.colors.border, 0.95)
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(tokens.colors.accent, 0.75)
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.colors.accent,
              boxShadow: `0 0 0 3px ${alpha(tokens.colors.accent, isLight ? 0.2 : 0.22)}`
            },
            '&.Mui-disabled': {
              backgroundColor: alpha(tokens.colors.surfaceRaised, 0.65)
            },
            '& .MuiOutlinedInput-input': {
              paddingTop: 9,
              paddingBottom: 9,
              lineHeight: 1.45
            },
            '& .MuiOutlinedInput-input[type="date"], & .MuiOutlinedInput-input[type="datetime-local"], & .MuiOutlinedInput-input[type="time"]': {
              minHeight: '1.4em'
            },
            '& .MuiOutlinedInput-inputMultiline': {
              paddingTop: 0,
              paddingBottom: 0
            },
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
              minHeight: '1.4em',
              lineHeight: 1.45
            }
          })
        }
      },
      MuiInputLabel: {
        defaultProps: {
          shrink: true
        },
        styleOverrides: {
          root: {
            color: tokens.colors.textSecondary,
            '&.Mui-focused': {
              color: tokens.colors.link
            },
            '&.MuiInputLabel-shrink': {
              backgroundColor: alpha(tokens.colors.surface, isLight ? 0.95 : 0.86),
              paddingInline: 4,
              borderRadius: 4,
              lineHeight: 1.1
            }
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginTop: 6,
            color: tokens.colors.textSecondary,
            '&.Mui-error': {
              color: tokens.colors.negative
            },
            '&.Mui-disabled': {
              color: tokens.colors.textDisabled
            }
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 999
          },
          outlined: {
            color: tokens.colors.textSecondary,
            borderColor: alpha(tokens.colors.border, 0.95),
            backgroundColor: alpha(tokens.colors.surfaceRaised, 0.58)
          },
          colorPrimary: {
            backgroundColor: alpha(tokens.colors.accent, 0.92),
            color: tokens.colors.accentContrast
          },
          colorSuccess: {
            backgroundColor: alpha(tokens.colors.positive, 0.9),
            color: '#03170d'
          },
          colorError: {
            backgroundColor: alpha(tokens.colors.negative, 0.92),
            color: '#320b0b'
          },
          colorWarning: {
            backgroundColor: alpha(tokens.colors.warning, 0.94),
            color: '#2d1901'
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.card
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontSize: 12,
            fontWeight: 700,
            color: tokens.colors.textPrimary,
            backgroundColor: tokens.colors.surfaceRaised,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            borderBottom: `1px solid ${alpha(tokens.colors.border, 0.95)}`
          },
          body: {
            fontSize: 13,
            color: tokens.colors.textPrimary,
            borderBottom: `1px solid ${alpha(tokens.colors.border, 0.72)}`
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': {
              backgroundColor: alpha(tokens.colors.accent, isLight ? 0.07 : 0.08)
            }
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 2
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.input,
            color: tokens.colors.textSecondary,
            '&:hover': {
              backgroundColor: alpha(tokens.colors.accent, isLight ? 0.09 : 0.12),
              color: tokens.colors.textPrimary
            }
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: tokens.colors.tooltip,
            color: tokens.colors.textPrimary,
            border: `1px solid ${alpha(tokens.colors.border, 0.95)}`,
            fontSize: 12,
            padding: '8px 10px',
            borderRadius: 8,
            boxShadow: tokens.shadows.card
          }
        }
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            color: tokens.colors.textPrimary,
            border: `1px solid ${alpha(tokens.colors.border, 0.95)}`,
            borderRadius: tokens.radius.card,
            backgroundColor: tokens.colors.surface,
            '--DataGrid-rowBorderColor': alpha(tokens.colors.border, 0.72),
            '--DataGrid-containerBackground': tokens.colors.surfaceRaised
          },
          columnHeaders: {
            color: tokens.colors.textPrimary,
            backgroundColor: tokens.colors.surfaceRaised,
            borderBottom: `1px solid ${alpha(tokens.colors.border, 0.95)}`
          },
          columnHeaderTitle: {
            fontWeight: 700,
            color: tokens.colors.textPrimary
          },
          row: {
            '&:hover': {
              backgroundColor: alpha(tokens.colors.accent, isLight ? 0.07 : 0.08)
            }
          },
          cell: {
            color: tokens.colors.textPrimary,
            borderBottom: `1px solid ${alpha(tokens.colors.border, 0.65)}`
          },
          footerContainer: {
            color: tokens.colors.textSecondary,
            backgroundColor: tokens.colors.surfaceRaised,
            borderTop: `1px solid ${alpha(tokens.colors.border, 0.95)}`
          }
        }
      }
    }
  })
}

export const createAppTheme = (mode: AppThemeMode = 'dark') => buildAppTheme(mode)

const theme = createAppTheme('dark')

export default theme
