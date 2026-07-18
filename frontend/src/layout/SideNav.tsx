import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { Link } from 'react-router-dom'
import { ReactNode } from 'react'
import logoLockup from '../assets/brand/tradejaudit-navbar.png'
import logoMark from '../assets/brand/tradejaudit-mark.png'

export type SideNavItem = {
  label: string
  path: string
  icon: ReactNode
}

export type SideNavSection = {
  key: 'trading' | 'journal' | 'system'
  label: string
  items: SideNavItem[]
}

type SideNavProps = {
  sections: SideNavSection[]
  pathname: string
  collapsed: boolean
  isMobile: boolean
  userEmail?: string
  onToggleCollapse: () => void
  onNavigate: () => void
  collapseLabel: string
  expandLabel: string
  homeLabel: string
}

const isItemActive = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`)

export default function SideNav({
  sections,
  pathname,
  collapsed,
  isMobile,
  userEmail,
  onToggleCollapse,
  onNavigate,
  collapseLabel,
  expandLabel,
  homeLabel
}: SideNavProps) {
  const theme = useTheme()

  return (
    <Stack sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: collapsed ? 0.75 : 2,
          py: 1.75,
          minHeight: collapsed ? 72 : 82,
          gap: collapsed ? 0.5 : 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box
          component={Link}
          to="/today"
          onClick={onNavigate}
          aria-label={homeLabel}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: 1.5,
            p: theme.palette.mode === 'dark' ? (collapsed ? 0.25 : 0.5) : 0,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.94)' : 'transparent'
          }}
        >
          <Box
            component="img"
            src={collapsed ? logoMark : logoLockup}
            alt="TradeJAudit"
            sx={{
              width: collapsed ? 40 : 205,
              maxWidth: '100%',
              maxHeight: collapsed ? 46 : 52,
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </Box>

        {!isMobile && (
          <Tooltip title={collapsed ? expandLabel : collapseLabel}>
            <IconButton
              aria-label={collapsed ? expandLabel : collapseLabel}
              onClick={onToggleCollapse}
              size="small"
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0
              }}
            >
              {collapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ChevronLeftRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <List
        disablePadding
        sx={{
          px: collapsed ? 0.75 : 1.25,
          py: 1.5,
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0
        }}
      >
        {sections.map((section) => (
          <Box key={section.key} sx={{ mb: 1.25 }}>
            {!collapsed && (
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: 'text.secondary',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  px: 1.5,
                  py: 0.5
                }}
              >
                {section.label}
              </ListSubheader>
            )}

            {section.items.map((item) => {
              const selected = isItemActive(pathname, item.path)
              const button = (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={item.path}
                  selected={selected}
                  onClick={onNavigate}
                  sx={{
                    minHeight: 44,
                    px: collapsed ? 1.1 : 1.5,
                    mb: 0.4,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 999,
                    color: selected ? 'text.primary' : 'text.secondary',
                    '& .MuiListItemIcon-root': {
                      minWidth: collapsed ? 'auto' : 34,
                      color: 'inherit'
                    },
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      color: 'text.primary',
                      '&:hover': {
                        bgcolor: 'action.selected'
                      }
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                      color: 'text.primary'
                    }
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        noWrap: true,
                        fontWeight: selected ? 600 : 500,
                        fontSize: 14
                      }}
                    />
                  )}
                </ListItemButton>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.path} placement="right" title={item.label}>
                    {button}
                  </Tooltip>
                )
              }

              return button
            })}
          </Box>
        ))}
      </List>

      <Box sx={{ p: collapsed ? 1 : 2, pt: 1.25 }}>
        <Divider sx={{ mb: 1.25 }} />
        <Tooltip disableHoverListener={!collapsed} title={userEmail || ''}>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{
              display: 'block',
              textAlign: collapsed ? 'center' : 'left',
              px: collapsed ? 0 : 0.5
            }}
          >
            {collapsed ? (userEmail?.[0]?.toUpperCase() || 'T') : userEmail || 'tradejaudit.app'}
          </Typography>
        </Tooltip>
      </Box>
    </Stack>
  )
}
