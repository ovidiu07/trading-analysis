export type TemplateFieldDefinition = {
  key: string
  labelKey: string
  hintKey: string
  minRows?: number
  required?: boolean
}

const BASE_FIELDS: TemplateFieldDefinition[] = [
  {
    key: 'context',
    labelKey: 'adminEditor.template.context.label',
    hintKey: 'adminEditor.template.context.hint',
    minRows: 2
  },
  {
    key: 'executionRules',
    labelKey: 'adminEditor.template.executionRules.label',
    hintKey: 'adminEditor.template.executionRules.hint',
    minRows: 3
  }
]

const TEMPLATE_FIELDS_BY_TYPE: Record<string, TemplateFieldDefinition[]> = {
  DAILY_PLAN: [
    {
      key: 'biasSummary',
      labelKey: 'adminEditor.template.biasSummary.label',
      hintKey: 'adminEditor.template.biasSummary.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'keyLevels',
      labelKey: 'adminEditor.template.keyLevels.label',
      hintKey: 'adminEditor.template.keyLevels.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'liquidityNarrative',
      labelKey: 'adminEditor.template.liquidityNarrative.label',
      hintKey: 'adminEditor.template.liquidityNarrative.hint',
      minRows: 3
    },
    {
      key: 'primaryModel',
      labelKey: 'adminEditor.template.primaryModel.label',
      hintKey: 'adminEditor.template.primaryModel.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'alternativeScenario',
      labelKey: 'adminEditor.template.alternativeScenario.label',
      hintKey: 'adminEditor.template.alternativeScenario.hint',
      minRows: 2
    },
    {
      key: 'riskNote',
      labelKey: 'adminEditor.template.riskNote.label',
      hintKey: 'adminEditor.template.riskNote.hint',
      required: true,
      minRows: 2
    },
    ...BASE_FIELDS
  ],
  WEEKLY_PLAN: [
    {
      key: 'macroBias',
      labelKey: 'adminEditor.template.macroBias.label',
      hintKey: 'adminEditor.template.macroBias.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'highProbabilityWindows',
      labelKey: 'adminEditor.template.highProbabilityWindows.label',
      hintKey: 'adminEditor.template.highProbabilityWindows.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'noTradeRisks',
      labelKey: 'adminEditor.template.noTradeRisks.label',
      hintKey: 'adminEditor.template.noTradeRisks.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'keyLevels',
      labelKey: 'adminEditor.template.keyLevels.label',
      hintKey: 'adminEditor.template.keyLevels.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'watchlist',
      labelKey: 'adminEditor.template.watchlist.label',
      hintKey: 'adminEditor.template.watchlist.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'weekFocus',
      labelKey: 'adminEditor.template.weekFocus.label',
      hintKey: 'adminEditor.template.weekFocus.hint',
      minRows: 2
    },
    ...BASE_FIELDS
  ],
  STRATEGY: [
    {
      key: 'what',
      labelKey: 'adminEditor.template.what.label',
      hintKey: 'adminEditor.template.what.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'when',
      labelKey: 'adminEditor.template.when.label',
      hintKey: 'adminEditor.template.when.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'filters',
      labelKey: 'adminEditor.template.filters.label',
      hintKey: 'adminEditor.template.filters.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'entryModel',
      labelKey: 'adminEditor.template.entryModel.label',
      hintKey: 'adminEditor.template.entryModel.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'invalidation',
      labelKey: 'adminEditor.template.invalidation.label',
      hintKey: 'adminEditor.template.invalidation.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'targets',
      labelKey: 'adminEditor.template.targets.label',
      hintKey: 'adminEditor.template.targets.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'riskModel',
      labelKey: 'adminEditor.template.riskModel.label',
      hintKey: 'adminEditor.template.riskModel.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'failureModes',
      labelKey: 'adminEditor.template.failureModes.label',
      hintKey: 'adminEditor.template.failureModes.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'checklist',
      labelKey: 'adminEditor.template.checklist.label',
      hintKey: 'adminEditor.template.checklist.hint',
      minRows: 3
    }
  ],
  PLAYBOOK: [
    {
      key: 'what',
      labelKey: 'adminEditor.template.what.label',
      hintKey: 'adminEditor.template.what.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'when',
      labelKey: 'adminEditor.template.when.label',
      hintKey: 'adminEditor.template.when.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'filters',
      labelKey: 'adminEditor.template.filters.label',
      hintKey: 'adminEditor.template.filters.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'entryModel',
      labelKey: 'adminEditor.template.entryModel.label',
      hintKey: 'adminEditor.template.entryModel.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'invalidation',
      labelKey: 'adminEditor.template.invalidation.label',
      hintKey: 'adminEditor.template.invalidation.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'targets',
      labelKey: 'adminEditor.template.targets.label',
      hintKey: 'adminEditor.template.targets.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'riskModel',
      labelKey: 'adminEditor.template.riskModel.label',
      hintKey: 'adminEditor.template.riskModel.hint',
      required: true,
      minRows: 2
    },
    {
      key: 'failureModes',
      labelKey: 'adminEditor.template.failureModes.label',
      hintKey: 'adminEditor.template.failureModes.hint',
      required: true,
      minRows: 3
    },
    {
      key: 'checklist',
      labelKey: 'adminEditor.template.checklist.label',
      hintKey: 'adminEditor.template.checklist.hint',
      minRows: 3
    }
  ],
  CHECKLIST: [
    {
      key: 'items',
      labelKey: 'adminEditor.template.items.label',
      hintKey: 'adminEditor.template.items.hint',
      required: true,
      minRows: 4
    }
  ]
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value
}

export const templateFieldsForType = (contentTypeKey?: string | null) => {
  if (!contentTypeKey) {
    return []
  }
  return TEMPLATE_FIELDS_BY_TYPE[contentTypeKey.toUpperCase()] || []
}

export const templateFieldRecordFromContent = (
  contentTypeKey: string | null | undefined,
  templateFields: Record<string, unknown> | undefined
) => {
  const definitions = templateFieldsForType(contentTypeKey)
  if (definitions.length === 0) {
    return {}
  }
  return definitions.reduce<Record<string, string>>((acc, definition) => {
    acc[definition.key] = normalizeString(templateFields?.[definition.key])
    return acc
  }, {})
}

export const pruneTemplateFields = (values: Record<string, string>) => {
  const next: Record<string, string> = {}
  Object.entries(values).forEach(([key, value]) => {
    const normalized = value.trim()
    if (normalized) {
      next[key] = normalized
    }
  })
  return next
}
