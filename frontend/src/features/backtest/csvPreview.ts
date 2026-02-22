import type { CsvColumnMapping } from '../../api/backtest'

export type CsvPreviewTimeFormat = 'epochSec' | 'epochMs' | 'iso' | 'localDateTime' | 'unknown'

export type CsvPreviewColumn = {
  key: string
  header: string
  index: number
  occurrence: number
  displayName: string
}

export type CsvPreviewRow = {
  rowNumber: number
  values: string[]
}

export type CsvPreviewResult = {
  columns: CsvPreviewColumn[]
  rows: CsvPreviewRow[]
  mapping: CsvColumnMapping
  mappingComplete: boolean
  detectedTimeFormat?: CsvPreviewTimeFormat
  detectedTimeframe?: string
  dataFrom?: string
  dataTo?: string
  warnings: string[]
}

const REQUIRED_MAPPING_FIELDS: Array<keyof CsvColumnMapping> = [
  'timeColumn',
  'openColumn',
  'highColumn',
  'lowColumn',
  'closeColumn'
]

const TIMEFRAME_CANDIDATES = [
  { label: 'M1', seconds: 60 },
  { label: 'M5', seconds: 300 },
  { label: 'M15', seconds: 900 },
  { label: 'H1', seconds: 3600 },
  { label: 'D1', seconds: 86400 }
]

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

const detectDelimiter = (line: string) => {
  const counts = new Map<string, number>([
    [',', 0],
    [';', 0],
    ['\t', 0]
  ])
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && counts.has(char)) {
      counts.set(char, (counts.get(char) || 0) + 1)
    }
  }

  let best = ','
  let bestCount = -1
  counts.forEach((count, delimiter) => {
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  })
  return best
}

const parseCsvRecords = (text: string, maxRecords: number, delimiter: string) => {
  const records: string[][] = []
  const row: string[] = []
  let value = ''
  let inQuotes = false

  const pushCell = () => {
    row.push(value)
    value = ''
  }

  const pushRow = () => {
    const allBlank = row.every((cell) => cell.trim() === '')
    if (!allBlank) {
      records.push([...row])
    }
    row.length = 0
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        value += '"'
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && char === delimiter) {
      pushCell()
      continue
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1
      }
      pushCell()
      pushRow()
      if (records.length >= maxRecords) {
        return records
      }
      continue
    }
    value += char
  }

  if (value.length > 0 || row.length > 0) {
    pushCell()
    pushRow()
  }
  return records
}

const buildColumns = (headers: string[]): CsvPreviewColumn[] => {
  const occurrences = new Map<string, number>()
  return headers.map((header, index) => {
    const base = normalizeHeader(header) || `column${index + 1}`
    const occurrence = (occurrences.get(base) || 0) + 1
    occurrences.set(base, occurrence)
    const displayBase = header.trim() || `Column ${index + 1}`
    return {
      key: `c${index}`,
      header,
      index,
      occurrence,
      displayName: occurrence > 1 ? `${displayBase} (${occurrence})` : displayBase
    }
  })
}

const detectColumn = (columns: CsvPreviewColumn[], candidates: string[]) => {
  for (const candidate of candidates) {
    const exact = columns.find((column) => normalizeHeader(column.header) === candidate)
    if (exact) return exact
  }
  for (const candidate of candidates) {
    const partial = columns.find((column) => normalizeHeader(column.header).includes(candidate))
    if (partial) return partial
  }
  return null
}

const autoDetectMapping = (columns: CsvPreviewColumn[]): CsvColumnMapping => {
  const time = detectColumn(columns, ['time', 'timestamp', 'date', 'datetime', 'utc'])
  const open = detectColumn(columns, ['open', 'o'])
  const high = detectColumn(columns, ['high', 'h'])
  const low = detectColumn(columns, ['low', 'l'])
  const close = detectColumn(columns, ['close', 'c', 'last', 'price'])
  const volume = detectColumn(columns, ['volume', 'vol', 'tickvolume'])

  return {
    timeColumn: time?.key || '',
    openColumn: open?.key || '',
    highColumn: high?.key || '',
    lowColumn: low?.key || '',
    closeColumn: close?.key || '',
    volumeColumn: volume?.key || '',
    timezone: ''
  }
}

const parseTimestampValue = (raw: string): { ms: number | null; format?: CsvPreviewTimeFormat } => {
  const value = raw.trim()
  if (!value) return { ms: null }

  if (/^-?\d{13,17}$/.test(value)) {
    const epochMs = Number(value)
    return Number.isFinite(epochMs) ? { ms: epochMs, format: 'epochMs' } : { ms: null }
  }
  if (/^-?\d{10,12}$/.test(value)) {
    const epochSec = Number(value)
    return Number.isFinite(epochSec) ? { ms: epochSec * 1000, format: 'epochSec' } : { ms: null }
  }

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed)) {
    return { ms: parsed, format: hasExplicitTimezone ? 'iso' : 'localDateTime' }
  }
  return { ms: null, format: 'unknown' }
}

const inferTimeframe = (timestampsMs: number[]) => {
  if (timestampsMs.length < 2) return undefined
  const uniqueSorted = Array.from(new Set(timestampsMs)).sort((a, b) => a - b)
  if (uniqueSorted.length < 2) return undefined

  const diffs: number[] = []
  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const diff = Math.round((uniqueSorted[i] - uniqueSorted[i - 1]) / 1000)
    if (diff > 0) {
      diffs.push(diff)
    }
  }
  if (!diffs.length) return undefined
  diffs.sort((a, b) => a - b)
  const median = diffs[Math.floor(diffs.length / 2)]

  let best = TIMEFRAME_CANDIDATES[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of TIMEFRAME_CANDIDATES) {
    const distance = Math.abs(candidate.seconds - median)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best.label
}

const countGaps = (timestampsMs: number[], timeframe: string | undefined) => {
  if (!timeframe || timestampsMs.length < 2) return 0
  const expected = TIMEFRAME_CANDIDATES.find((item) => item.label === timeframe)?.seconds
  if (!expected) return 0
  const sorted = [...timestampsMs].sort((a, b) => a - b)
  const threshold = Math.max(expected + 1, Math.round(expected * 1.5))
  let gaps = 0
  for (let i = 1; i < sorted.length; i += 1) {
    const diffSec = Math.round((sorted[i] - sorted[i - 1]) / 1000)
    if (diffSec > threshold) {
      gaps += 1
    }
  }
  return gaps
}

export const isCsvMappingComplete = (mapping: CsvColumnMapping) => {
  return REQUIRED_MAPPING_FIELDS.every((key) => Boolean(mapping[key]?.trim()))
}

export const resolveHeaderFromColumnKey = (columns: CsvPreviewColumn[] | undefined, value: string | undefined) => {
  if (!value) return ''
  const column = (columns || []).find((item) => item.key === value)
  return column?.header || value
}

export const resolveColumnKeyFromHeader = (columns: CsvPreviewColumn[] | undefined, header: string | undefined) => {
  if (!header) return ''
  const direct = (columns || []).find((item) => item.header === header)
  if (direct) return direct.key
  const normalized = normalizeHeader(header)
  const fallback = (columns || []).find((item) => normalizeHeader(item.header) === normalized)
  return fallback?.key || header
}

export const parseCsvPreview = async (file: File, previewRowsLimit = 20): Promise<CsvPreviewResult> => {
  const text = await readFileText(file)
  const firstContentLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) || ''
  const delimiter = detectDelimiter(firstContentLine)
  const records = parseCsvRecords(text, Math.max(previewRowsLimit + 1, 240), delimiter)
  if (!records.length) {
    return {
      columns: [],
      rows: [],
      mapping: {
        timeColumn: '',
        openColumn: '',
        highColumn: '',
        lowColumn: '',
        closeColumn: '',
        volumeColumn: '',
        timezone: ''
      },
      mappingComplete: false,
      warnings: ['No CSV rows detected in selected file.']
    }
  }

  const headers = records[0]
  const columns = buildColumns(headers)
  const mapping = autoDetectMapping(columns)
  const mappingComplete = isCsvMappingComplete(mapping)
  const warnings: string[] = []

  const rows = records.slice(1, previewRowsLimit + 1).map((values, index) => ({
    rowNumber: index + 1,
    values
  }))

  const timestampColumn = columns.find((column) => column.key === mapping.timeColumn)
  const timestampsMs: number[] = []
  const formatCounts = new Map<CsvPreviewTimeFormat, number>()
  if (timestampColumn) {
    const sourceRows = records.slice(1)
    for (const values of sourceRows) {
      const raw = values[timestampColumn.index] || ''
      const parsed = parseTimestampValue(raw)
      if (parsed.ms !== null) {
        timestampsMs.push(parsed.ms)
      }
      if (parsed.format) {
        formatCounts.set(parsed.format, (formatCounts.get(parsed.format) || 0) + 1)
      }
    }
  }

  if (!mappingComplete) {
    warnings.push('Required column mapping is incomplete (time/open/high/low/close).')
  }

  let detectedTimeFormat: CsvPreviewTimeFormat | undefined
  let maxFormatCount = 0
  formatCounts.forEach((count, key) => {
    if (count > maxFormatCount) {
      detectedTimeFormat = key
      maxFormatCount = count
    }
  })

  const detectedTimeframe = inferTimeframe(timestampsMs)
  if (timestampsMs.length >= 2) {
    const sorted = [...timestampsMs].sort((a, b) => a - b)
    let unsortedDetected = false
    for (let i = 1; i < timestampsMs.length; i += 1) {
      if (timestampsMs[i] < timestampsMs[i - 1]) {
        unsortedDetected = true
        break
      }
    }
    if (unsortedDetected) {
      warnings.push('Detected unsorted timestamps in CSV sample.')
    }

    const gapCount = countGaps(sorted, detectedTimeframe)
    if (gapCount > 0) {
      warnings.push(`Detected ${gapCount} timestamp gaps in sampled data.`)
    }
  }

  const minTs = timestampsMs.length ? Math.min(...timestampsMs) : null
  const maxTs = timestampsMs.length ? Math.max(...timestampsMs) : null

  return {
    columns,
    rows,
    mapping,
    mappingComplete,
    detectedTimeFormat,
    detectedTimeframe,
    dataFrom: minTs === null ? undefined : new Date(minTs).toISOString(),
    dataTo: maxTs === null ? undefined : new Date(maxTs).toISOString(),
    warnings
  }
}

const readFileText = async (file: File): Promise<string> => {
  const withText = file as File & {
    text?: () => Promise<string>
    arrayBuffer?: () => Promise<ArrayBuffer>
  }
  if (typeof withText.text === 'function') {
    return withText.text()
  }
  if (typeof withText.arrayBuffer === 'function') {
    const buffer = await withText.arrayBuffer()
    return new TextDecoder().decode(buffer)
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('Could not read CSV file.'))
    reader.readAsText(file)
  })
}
