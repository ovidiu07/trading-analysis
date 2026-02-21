import { alpha, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'
import { AppThemeMode, getDesignTokens, toMuiPaletteMode } from './tokens'

declare module '@mui/material/styles' {
  interface Palette {
    chart: {
      grid: string
      axis: string
      positive: string
      negative: string
    }
  }

  interface PaletteOptions {
    chart?: {
      grid: string
      axis: string
      positive: string
      negative: string
    }
  }
}

const createFintechTheme = (mode: AppThemeMode): Theme => {
  const tokens = getDesignTokens(mode)
  const isLight = mode === 'light'
  const isBlackShiny = mode === 'black-shiny'
  const paletteMode = toMuiPaletteMode(mode)

  return createTheme({
    spacing: 8,
    shape: {
      borderRadius: tokens.radius.md
    },
    palette: {
      mode: paletteMode,
      primary: {
        main: tokens.brand.primary,
        dark: tokens.brand.primaryStrong,
        light: isLight ? '#4b7ff1' : isBlackShiny ? '#86edff' : '#9bc8ff',
        contrastText: tokens.text.inverse
      },
      secondary: {
        main: tokens.brand.secondary,
        contrastText: tokens.text.inverse
      },
      success: {
        main: tokens.feedback.success
      },
      warning: {
        main: tokens.feedback.warning
      },
      error: {
        main: tokens.feedback.error
      },
      info: {
        main: tokens.feedback.info
      },
      background: {
        default: tokens.surface.background,
        paper: tokens.surface.panel
      },
      text: {
        primary: tokens.text.primary,
        secondary: tokens.text.secondary,
        disabled: tokens.text.disabled
      },
      divider: tokens.border.subtle,
      action: {
        hover: tokens.interaction.hover,
        selected: tokens.interaction.selected,
        focus: tokens.interaction.pressed,
        active: tokens.text.secondary,
        disabled: alpha(tokens.text.disabled, 0.8),
        disabledBackground: alpha(tokens.surface.panelMuted, 0.7)
      },
      chart: {
        grid: tokens.chart.grid,
        axis: tokens.chart.axis,
        positive: tokens.chart.positive,
        negative: tokens.chart.negative
      }
    },
    typography: {
      fontFamily: '"Manrope", "Plus Jakarta Sans", "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: 15,
      h1: {
        fontWeight: 750,
        fontSize: '2.2rem',
        lineHeight: 1.15,
        letterSpacing: '-0.02em'
      },
      h2: {
        fontWeight: 740,
        fontSize: '1.85rem',
        lineHeight: 1.18,
        letterSpacing: '-0.02em'
      },
      h3: {
        fontWeight: 730,
        fontSize: '1.48rem',
        lineHeight: 1.22,
        letterSpacing: '-0.015em'
      },
      h4: {
        fontWeight: 700,
        fontSize: '1.2rem',
        lineHeight: 1.25,
        letterSpacing: '-0.01em'
      },
      h5: {
        fontWeight: 650,
        fontSize: '1.05rem',
        lineHeight: 1.38
      },
      h6: {
        fontWeight: 650,
        fontSize: '0.95rem',
        lineHeight: 1.4
      },
      subtitle1: {
        fontSize: '0.98rem',
        fontWeight: 600,
        lineHeight: 1.4
      },
      subtitle2: {
        fontSize: '0.84rem',
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '0.015em'
      },
      body1: {
        fontSize: '0.96rem',
        lineHeight: 1.58
      },
      body2: {
        fontSize: '0.88rem',
        lineHeight: 1.52
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.45
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.015em'
      }
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
            color: tokens.text.primary,
            backgroundColor: tokens.surface.background,
            backgroundImage: isLight
              ? `radial-gradient(1000px 500px at -8% -10%, ${alpha(tokens.brand.primary, 0.19)} 0%, rgba(255,255,255,0) 62%), radial-gradient(880px 420px at 105% -5%, ${alpha(tokens.brand.secondary, 0.16)} 0%, rgba(255,255,255,0) 58%), linear-gradient(180deg, ${tokens.surface.background} 0%, ${tokens.surface.app} 100%)`
              : isBlackShiny
                ? `radial-gradient(980px 440px at -12% -10%, ${alpha(tokens.brand.primary, 0.4)} 0%, rgba(0,0,0,0) 62%), radial-gradient(960px 460px at 112% -4%, ${alpha(tokens.brand.secondary, 0.28)} 0%, rgba(0,0,0,0) 58%), linear-gradient(180deg, #030303 0%, ${tokens.surface.background} 42%, ${tokens.surface.app} 100%)`
                : `radial-gradient(960px 500px at -10% -8%, ${alpha(tokens.brand.primary, 0.34)} 0%, rgba(0,0,0,0) 64%), radial-gradient(880px 460px at 108% -5%, ${alpha(tokens.brand.secondary, 0.2)} 0%, rgba(0,0,0,0) 58%), linear-gradient(180deg, ${tokens.surface.background} 0%, ${tokens.surface.app} 100%)`,
            backgroundAttachment: 'fixed'
          },
          '#root': {
            minHeight: '100%',
            width: '100%',
            maxWidth: '100%',
            overflowX: 'clip'
          },
          'img, video, canvas': {
            maxWidth: '100%',
            height: 'auto'
          },
          'textarea[aria-hidden="true"]': {
            // Keep MUI TextareaAutosize measurement nodes hidden to avoid ghost "x" mirrors.
            visibility: 'hidden !important',
            position: 'absolute !important',
            overflow: 'hidden !important',
            height: '0 !important',
            top: 0,
            left: 0,
            pointerEvents: 'none'
          },
          a: {
            color: tokens.brand.primary
          },
          '.metric-value': {
            fontFamily: 'var(--app-font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum"'
          },
          '.surface-hero': {
            background: isLight
              ? `linear-gradient(140deg, ${alpha(tokens.brand.primary, 0.14)} 0%, ${alpha(tokens.brand.secondary, 0.1)} 58%, ${alpha(tokens.surface.panel, 0.96)} 100%)`
              : isBlackShiny
                ? `linear-gradient(145deg, ${alpha(tokens.brand.primary, 0.34)} 0%, ${alpha(tokens.brand.secondary, 0.2)} 48%, ${alpha(tokens.surface.panel, 0.96)} 100%)`
                : `linear-gradient(140deg, ${alpha(tokens.brand.primary, 0.3)} 0%, ${alpha(tokens.brand.secondary, 0.16)} 62%, ${alpha(tokens.surface.panel, 0.94)} 100%)`
          },
          '.interactive-lift': {
            transition: 'transform 180ms ease, box-shadow 180ms ease'
          },
          '.interactive-lift:hover': {
            transform: 'translateY(-2px)'
          },
          ':focus-visible': {
            outline: `2px solid ${tokens.border.focus}`,
            outlineOffset: 2
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.surface.header,
            color: tokens.text.primary,
            backdropFilter: 'blur(20px) saturate(1.35)',
            borderBottom: `1px solid ${tokens.border.subtle}`,
            boxShadow: 'none'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.surface.sidebar,
            color: tokens.text.primary,
            borderRight: `1px solid ${tokens.border.subtle}`
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.surface.panel,
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.border.subtle}`,
            backdropFilter: isBlackShiny ? 'blur(14px) saturate(1.2)' : 'blur(10px) saturate(1.15)'
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.border.subtle}`,
            boxShadow: tokens.elevation.card,
            overflow: 'hidden'
          }
        }
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            paddingBottom: 8
          },
          title: {
            fontSize: '1rem',
            fontWeight: 650
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: tokens.radius.sm,
            transition: 'all 150ms ease'
          },
          contained: {
            backgroundImage: `linear-gradient(135deg, ${tokens.brand.gradientStart} 0%, ${tokens.brand.gradientEnd} 100%)`,
            color: tokens.text.inverse,
            boxShadow: isBlackShiny ? `0 0 0 1px ${alpha(tokens.brand.primary, 0.45)}, 0 10px 24px ${alpha(tokens.brand.primary, 0.18)}` : 'none',
            '&:hover': {
              boxShadow: tokens.elevation.floating,
              transform: 'translateY(-1px)'
            }
          },
          outlined: {
            borderWidth: 1,
            borderColor: tokens.border.strong,
            '&:hover': {
              borderWidth: 1,
              borderColor: tokens.brand.primary
            }
          },
          text: {
            color: tokens.brand.primary,
            '&:hover': {
              backgroundColor: tokens.interaction.hover
            }
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.sm,
            color: tokens.text.secondary,
            transition: 'all 150ms ease',
            '&:hover': {
              backgroundColor: tokens.interaction.hover,
              color: tokens.text.primary
            }
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            fontSize: '0.9rem',
            lineHeight: 1.45,
            '&::placeholder': {
              color: alpha(tokens.text.muted, 0.92)
            }
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: tokens.radius.sm,
            backgroundColor: tokens.surface.panelMuted,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.border.subtle
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.border.strong
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.border.focus,
              boxShadow: `0 0 0 3px ${alpha(tokens.brand.primary, isLight ? 0.2 : 0.28)}`
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: tokens.text.secondary,
            '&.Mui-focused': {
              color: tokens.brand.primary
            }
          }
        }
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginTop: 6,
            color: tokens.text.secondary
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.sm
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 999
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.pill,
            fontWeight: 600,
            height: 28
          },
          outlined: {
            borderColor: tokens.border.strong,
            backgroundColor: alpha(tokens.surface.panelMuted, 0.76)
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: alpha(tokens.surface.panelMuted, 0.82),
            color: tokens.text.primary,
            borderBottom: `1px solid ${tokens.border.subtle}`,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          },
          body: {
            borderBottom: `1px solid ${alpha(tokens.border.subtle, 0.7)}`,
            fontSize: 13
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': {
              backgroundColor: tokens.interaction.hover
            }
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 10,
            backgroundColor: isLight ? '#ffffff' : '#0f1a2d',
            border: `1px solid ${tokens.border.subtle}`,
            color: tokens.text.primary,
            boxShadow: tokens.elevation.card
          }
        }
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.surface.panel,
            '--DataGrid-rowBorderColor': alpha(tokens.border.subtle, 0.8),
            '--DataGrid-containerBackground': tokens.surface.panelMuted
          },
          columnHeaders: {
            borderBottom: `1px solid ${tokens.border.subtle}`,
            backgroundColor: alpha(tokens.surface.panelMuted, 0.9)
          },
          columnHeaderTitle: {
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.04em'
          },
          row: {
            '&:hover': {
              backgroundColor: tokens.interaction.hover
            }
          },
          cell: {
            borderBottom: `1px solid ${alpha(tokens.border.subtle, 0.6)}`
          },
          footerContainer: {
            borderTop: `1px solid ${tokens.border.subtle}`,
            backgroundColor: alpha(tokens.surface.panelMuted, 0.9)
          }
        }
      }
    }
  })
}

export const createAppTheme = (mode: AppThemeMode = 'dark') => createFintechTheme(mode)

const theme = createAppTheme('dark')

export default theme
