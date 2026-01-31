import { alpha, createTheme } from '@mui/material'

const theme = createTheme({
  spacing: 8,
  shape: {
    borderRadius: 12
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#1f6feb',
      light: '#6ea8fe',
      dark: '#1b4fbf'
    },
    secondary: {
      main: '#5c6ac4'
    },
    success: {
      main: '#1f9d55',
      light: '#d1fae5'
    },
    error: {
      main: '#d64545',
      light: '#fde2e2'
    },
    warning: {
      main: '#f4b740'
    },
    info: {
      main: '#1c64f2'
    },
    background: {
      default: '#f4f6fb',
      paper: '#ffffff'
    },
    text: {
      primary: '#0b1f36',
      secondary: '#5b6b7b'
    },
    divider: '#e2e8f0'
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: 32, fontWeight: 700, letterSpacing: -0.5 },
    h2: { fontSize: 28, fontWeight: 700, letterSpacing: -0.4 },
    h3: { fontSize: 24, fontWeight: 700 },
    h4: { fontSize: 22, fontWeight: 700 },
    h5: { fontSize: 20, fontWeight: 700 },
    h6: { fontSize: 18, fontWeight: 600 },
    subtitle1: { fontSize: 15, fontWeight: 500 },
    subtitle2: { fontSize: 13, fontWeight: 600 },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
    caption: { fontSize: 12 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f4f6fb'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#ffffff',
          color: '#0b1f36',
          borderBottom: '1px solid #e2e8f0'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          borderRight: '0'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.08)'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d0d7e2'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94a3b8'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1f6feb',
            boxShadow: `0 0 0 3px ${alpha('#1f6feb', 0.2)}`
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#5b6b7b'
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
          borderRadius: 16
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 12,
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        },
        body: {
          fontSize: 13
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
          borderRadius: 10
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0f172a',
          fontSize: 12,
          padding: '8px 10px',
          borderRadius: 8
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          borderRadius: 12
        },
        columnHeaders: {
          backgroundColor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0'
        },
        cell: {
          borderBottom: '1px solid #e2e8f0'
        }
      }
    }
  }
})

export default theme
