import { NotebookNoteType } from '../../api/notebook'

export type NotebookSmartViewKey = 'ALL_NOTES' | 'DAILY_LOGS' | 'PLANS' | 'RECAPS' | 'PINNED' | 'RECENTLY_DELETED'

export type NotebookNavigationState =
  | { kind: 'smart'; key: NotebookSmartViewKey }
  | { kind: 'folder'; folderId: string }

export type LinkedTradeFilter = 'ALL' | 'YES' | 'NO'
export type AttachmentPresenceFilter = 'ALL' | 'YES' | 'NO'

export type AdvancedNoteFilters = {
  folderId: string
  type: 'ALL' | NotebookNoteType
  tagIds: string[]
  from: string
  to: string
  linkedTrade: LinkedTradeFilter
  hasAttachments: AttachmentPresenceFilter
}

export type NoteSortOrder = 'updated' | 'created' | 'date'

export type NotePanelMode = 'read' | 'edit'

export type NoteContentTab = 'content' | 'review'

export type SetupQuality = 'A' | 'B' | 'C'

export type NoteReview = {
  setupQuality: SetupQuality | null
  followedPlan: boolean | null
  ruleBreaks: string[]
  didWell: string
  improveNext: string
  nextRule: string
}

export type NoteReviewRuleBreak =
  | 'early_exit'
  | 'oversize'
  | 'revenge'
  | 'moved_stop_loss'
  | 'chased_entry'
  | 'no_entry_criteria'
  | 'added_without_setup'
  | 'ignored_news'
  | 'no_risk_plan'
