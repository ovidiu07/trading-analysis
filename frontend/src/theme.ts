import { alpha, createTheme } from '@mui/material'
import type {} from '@mui/x-data-grid/themeAugmentation'

export const terminalTokens = {
  spacing: [4, 8, 12, 16, 24, 32] as const,
  radius: {
    card: 14,
    input: 10
  },
  colors: {
    background: '#070c14',
    surface: '#111a27',
    surfaceRaised: '#152134',
    border: '#273447',
    textPrimary: '#e5edf8',
    textSecondary: '#92a3bd',
    accent: '#45a3ff',
    positive: '#24b774',
    negative: '#e76060'
  }
}

const theme = createTheme({
  spacing: 8,
  shape: {
    borderRadius: terminalTokens.radius.card
  },
  palette: {
    mode: 'dark',
    primary: {
      main: terminalTokens.colors.accent,
      light: '#7ec2ff',
      dark: '#246ebf'
    },
    secondary: {
      main: '#3d8bff'
    },
    success: {
      main: terminalTokens.colors.positive,
      light: alpha(terminalTokens.colors.positive, 0.2)
    },
    error: {
      main: terminalTokens.colors.negative,
      light: alpha(terminalTokens.colors.negative, 0.2)
    },
    warning: {
      main: '#f4ae45'
    },
    info: {
      main: '#64b5ff'
    },
    background: {
      default: terminalTokens.colors.background,
      paper: terminalTokens.colors.surface
    },
    text: {
      primary: terminalTokens.colors.textPrimary,
      secondary: terminalTokens.colors.textSecondary
    },
    divider: alpha(terminalTokens.colors.border, 0.85),
    action: {
      hover: alpha('#ffffff', 0.04),
      selected: alpha(terminalTokens.colors.accent, 0.2),
      focus: alpha(terminalTokens.colors.accent, 0.28)
    }
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: 28, fontWeight: 700, letterSpacing: -0.3 },
    h2: { fontSize: 24, fontWeight: 700, letterSpacing: -0.2 },
    h3: { fontSize: 22, fontWeight: 700 },
    h4: { fontSize: 20, fontWeight: 700 },
    h5: { fontSize: 18, fontWeight: 700 },
    h6: { fontSize: 16, fontWeight: 600 },
    subtitle1: { fontSize: 14, fontWeight: 600 },
    subtitle2: { fontSize: 13, fontWeight: 600, letterSpacing: 0.15 },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
    caption: { fontSize: 12 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          width: '100%'
        },
        body: {
          width: '100%',
          margin: 0,
          background: `radial-gradient(circle at 20% 0%, ${alpha('#1c2f4b', 0.35)} 0%, ${terminalTokens.colors.background} 55%)`
        },
        '#root': {
          width: '100%',
          minHeight: '100%'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha('#0b1320', 0.92),
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.9)}`
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#0d1522',
          color: terminalTokens.colors.textPrimary,
          borderRight: `1px solid ${alpha(terminalTokens.colors.border, 0.9)}`
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: terminalTokens.radius.card,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.75)}`
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: terminalTokens.radius.card,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.75)}`,
          backgroundColor: terminalTokens.colors.surface,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.16), 0 10px 24px rgba(0,0,0,0.2)'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: terminalTokens.radius.input,
          textTransform: 'none',
          fontWeight: 600
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: terminalTokens.colors.surfaceRaised,
          borderRadius: terminalTokens.radius.input,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(terminalTokens.colors.border, 0.9)
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(terminalTokens.colors.accent, 0.75)
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: terminalTokens.colors.accent,
            boxShadow: `0 0 0 3px ${alpha(terminalTokens.colors.accent, 0.2)}`
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: terminalTokens.colors.textSecondary
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 999
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: terminalTokens.radius.card
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 12,
          fontWeight: 700,
          color: terminalTokens.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.85)}`
        },
        body: {
          fontSize: 13,
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.65)}`
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
          borderRadius: terminalTokens.radius.input
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0d1522',
          color: terminalTokens.colors.textPrimary,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.9)}`,
          fontSize: 12,
          padding: '8px 10px',
          borderRadius: 8
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.85)}`,
          borderRadius: terminalTokens.radius.card,
          backgroundColor: terminalTokens.colors.surface
        },
        columnHeaders: {
          backgroundColor: '#0f1827',
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.85)}`
        },
        cell: {
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.55)}`
        }
      }
    }
  }
})

export default theme
