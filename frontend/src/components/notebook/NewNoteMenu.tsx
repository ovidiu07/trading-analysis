import { MouseEvent, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import { NotebookNoteType } from '../../api/notebook'
import { useI18n } from '../../i18n'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import TodayIcon from '@mui/icons-material/Today'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AssignmentIcon from '@mui/icons-material/Assignment'
import SummarizeIcon from '@mui/icons-material/Summarize'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'

type NewNoteMenuProps = {
  disabled?: boolean
  onCreate: (type: NotebookNoteType) => void
  onCreateFromTemplate?: () => void
  onCreateLossRecap?: () => void
}

export default function NewNoteMenu({
  disabled = false,
  onCreate,
  onCreateFromTemplate,
  onCreateLossRecap
}: NewNoteMenuProps) {
  const { t } = useI18n()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget)
  }

  const handleClose = () => {
    setAnchor(null)
  }

  const handleCreate = (type: NotebookNoteType) => {
    handleClose()
    onCreate(type)
  }

  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        disabled={disabled}
        onClick={handleOpen}
      >
        {t('notebook.actions.new')}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={handleClose}>
        <MenuItem onClick={() => handleCreate('DAILY_LOG')}>
          <ListItemIcon><TodayIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('notebook.actions.newDailyLog')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCreate('TRADE_NOTE')}>
          <ListItemIcon><TrendingUpIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('notebook.actions.newTradeNote')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCreate('PLAN')}>
          <ListItemIcon><AssignmentIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('notebook.actions.newPlan')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCreate('SESSION_RECAP')}>
          <ListItemIcon><SummarizeIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('notebook.actions.newRecap')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCreate('GOAL')}>
          <ListItemIcon><EmojiEventsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('notebook.actions.newGoal')}</ListItemText>
        </MenuItem>
        {onCreateFromTemplate && (
          <MenuItem onClick={() => {
            handleClose()
            onCreateFromTemplate()
          }}>
            <ListItemIcon><AutoFixHighIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('notebook.actions.fromTemplate')}</ListItemText>
          </MenuItem>
        )}
        {onCreateLossRecap && (
          <>
            <Divider />
            <MenuItem onClick={() => {
              handleClose()
              onCreateLossRecap()
            }}>
              <ListItemText>{t('notebook.actions.createLossRecap')}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  )
}
