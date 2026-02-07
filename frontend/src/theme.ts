import { alpha, createTheme } from '@mui/material'
import type {} from '@mui/x-data-grid/themeAugmentation'

export const terminalTokens = {
  spacing: [4, 8, 12, 16, 24, 32] as const,
  radius: {
    card: 14,
    input: 10
  },
  colors: {
    background: '#060b12',
    surface: '#101927',
    surfaceRaised: '#172438',
    border: '#2d3f56',
    textPrimary: '#eef4ff',
    textSecondary: '#b6c3d8',
    textMuted: '#95a5bd',
    textDisabled: '#7385a1',
    link: '#7fc1ff',
    linkHover: '#b2daff',
    accent: '#45a3ff',
    positive: '#2ac17c',
    negative: '#ef6e6e'
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
      light: '#8bc9ff',
      dark: '#266ab1'
    },
    secondary: {
      main: '#63b2ff'
    },
    success: {
      main: terminalTokens.colors.positive,
      light: alpha(terminalTokens.colors.positive, 0.24)
    },
    error: {
      main: terminalTokens.colors.negative,
      light: alpha(terminalTokens.colors.negative, 0.24)
    },
    warning: {
      main: '#f4ae45'
    },
    info: {
      main: '#7abfff'
    },
    background: {
      default: terminalTokens.colors.background,
      paper: terminalTokens.colors.surface
    },
    text: {
      primary: terminalTokens.colors.textPrimary,
      secondary: terminalTokens.colors.textSecondary,
      disabled: terminalTokens.colors.textDisabled
    },
    divider: alpha(terminalTokens.colors.border, 0.95),
    action: {
      hover: alpha('#ffffff', 0.08),
      selected: alpha(terminalTokens.colors.accent, 0.26),
      focus: alpha(terminalTokens.colors.accent, 0.34),
      disabled: alpha(terminalTokens.colors.textDisabled, 0.72),
      disabledBackground: alpha(terminalTokens.colors.surfaceRaised, 0.7)
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
          color: terminalTokens.colors.textPrimary,
          background: `radial-gradient(circle at 20% 0%, ${alpha('#1c2f4b', 0.35)} 0%, ${terminalTokens.colors.background} 55%)`
        },
        a: {
          color: terminalTokens.colors.link,
          textDecorationColor: alpha(terminalTokens.colors.link, 0.8),
          '&:hover': {
            color: terminalTokens.colors.linkHover
          }
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
          color: terminalTokens.colors.textPrimary,
          background: alpha('#0b1320', 0.92),
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#0c1624',
          color: terminalTokens.colors.textPrimary,
          borderRight: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: terminalTokens.colors.surface,
          color: terminalTokens.colors.textPrimary,
          borderRadius: terminalTokens.radius.card,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.8)}`
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: terminalTokens.radius.card,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.8)}`,
          backgroundColor: terminalTokens.colors.surface,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.18), 0 10px 24px rgba(0,0,0,0.24)'
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
        },
        text: {
          color: terminalTokens.colors.link,
          '&:hover': {
            backgroundColor: alpha(terminalTokens.colors.link, 0.12),
            color: terminalTokens.colors.linkHover
          }
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: terminalTokens.colors.link,
          textDecorationColor: alpha(terminalTokens.colors.link, 0.8),
          '&:hover': {
            color: terminalTokens.colors.linkHover
          }
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: terminalTokens.colors.textPrimary
        },
        input: {
          '&::placeholder': {
            color: alpha(terminalTokens.colors.textMuted, 0.95),
            opacity: 1
          },
          '&.Mui-disabled': {
            WebkitTextFillColor: terminalTokens.colors.textMuted,
            color: terminalTokens.colors.textMuted
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: terminalTokens.colors.surfaceRaised,
          borderRadius: terminalTokens.radius.input,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(terminalTokens.colors.border, 0.95)
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(terminalTokens.colors.accent, 0.8)
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: terminalTokens.colors.accent,
            boxShadow: `0 0 0 3px ${alpha(terminalTokens.colors.accent, 0.22)}`
          },
          '&.Mui-disabled': {
            backgroundColor: alpha(terminalTokens.colors.surfaceRaised, 0.7)
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: terminalTokens.colors.textSecondary,
          '&.Mui-focused': {
            color: terminalTokens.colors.link
          }
        }
      }
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: terminalTokens.colors.textSecondary,
          '&.Mui-error': {
            color: terminalTokens.colors.negative
          },
          '&.Mui-disabled': {
            color: terminalTokens.colors.textDisabled
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
          color: terminalTokens.colors.textSecondary,
          borderColor: alpha(terminalTokens.colors.border, 0.95),
          backgroundColor: alpha(terminalTokens.colors.surfaceRaised, 0.5)
        },
        colorPrimary: {
          backgroundColor: alpha(terminalTokens.colors.accent, 0.92),
          color: '#041525'
        },
        colorSuccess: {
          backgroundColor: alpha(terminalTokens.colors.positive, 0.9),
          color: '#02170e'
        },
        colorError: {
          backgroundColor: alpha(terminalTokens.colors.negative, 0.92),
          color: '#2c0b0b'
        },
        colorWarning: {
          backgroundColor: alpha('#f4ae45', 0.95),
          color: '#2f1c02'
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
          color: terminalTokens.colors.textPrimary,
          backgroundColor: terminalTokens.colors.surfaceRaised,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`
        },
        body: {
          fontSize: 13,
          color: terminalTokens.colors.textPrimary,
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.7)}`
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: alpha('#ffffff', 0.06)
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
          borderRadius: terminalTokens.radius.input,
          color: terminalTokens.colors.textSecondary,
          '&:hover': {
            backgroundColor: alpha('#ffffff', 0.08),
            color: terminalTokens.colors.textPrimary
          }
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0d1522',
          color: terminalTokens.colors.textPrimary,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`,
          fontSize: 12,
          padding: '8px 10px',
          borderRadius: 8
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          color: terminalTokens.colors.textPrimary,
          border: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`,
          borderRadius: terminalTokens.radius.card,
          backgroundColor: terminalTokens.colors.surface,
          '--DataGrid-rowBorderColor': alpha(terminalTokens.colors.border, 0.72),
          '--DataGrid-containerBackground': terminalTokens.colors.surfaceRaised
        },
        columnHeaders: {
          color: terminalTokens.colors.textPrimary,
          backgroundColor: terminalTokens.colors.surfaceRaised,
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`
        },
        columnHeaderTitle: {
          fontWeight: 700,
          color: terminalTokens.colors.textPrimary
        },
        row: {
          '&:hover': {
            backgroundColor: alpha('#ffffff', 0.06)
          }
        },
        cell: {
          color: terminalTokens.colors.textPrimary,
          borderBottom: `1px solid ${alpha(terminalTokens.colors.border, 0.65)}`
        },
        footerContainer: {
          color: terminalTokens.colors.textSecondary,
          backgroundColor: terminalTokens.colors.surfaceRaised,
          borderTop: `1px solid ${alpha(terminalTokens.colors.border, 0.95)}`
        }
      }
    }
  }
})

export default theme
