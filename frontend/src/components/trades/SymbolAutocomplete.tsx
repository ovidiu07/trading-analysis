import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Autocomplete, Chip, Stack, TextField, Typography } from '@mui/material'
import { searchSymbols, type SymbolSearchResult } from '../../api/symbols'
import { TradeRequest } from '../../api/trades'
import { useI18n } from '../../i18n'

const RECENT_SYMBOLS_KEY = 'trades.recentSymbols.v1'
const MAX_RECENT_SYMBOLS = 20

type SymbolAutocompleteProps = {
  value: string
  market?: TradeRequest['market']
  onChange: (symbol: string) => void
  label?: string
  required?: boolean
  error?: boolean
  helperText?: string
  autoFocus?: boolean
}

type SymbolOption = {
  symbol: string
  name?: string | null
  exchange?: string | null
  currency?: string | null
  market?: TradeRequest['market'] | null
  source: 'recent' | 'remote'
}

const normalizeSymbol = (value: string) => value.trim().toUpperCase()

export const loadRecentSymbols = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_SYMBOLS_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => normalizeSymbol(entry))
      .filter(Boolean)
      .slice(0, MAX_RECENT_SYMBOLS)
  } catch {
    return []
  }
}

export const saveRecentSymbol = (symbol: string) => {
  const normalized = normalizeSymbol(symbol)
  if (!normalized) return
  const next = [normalized, ...loadRecentSymbols().filter((entry) => entry !== normalized)].slice(0, MAX_RECENT_SYMBOLS)
  localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(next))
}

const toOptionLabel = (option: SymbolOption) => {
  if (!option.name && !option.exchange) {
    return option.symbol
  }

  const descriptionParts: string[] = []
  if (option.name) descriptionParts.push(option.name)
  if (option.exchange) descriptionParts.push(`(${option.exchange})`)

  return `${option.symbol} — ${descriptionParts.join(' ')}`
}

const mapSearchResultToOption = (item: SymbolSearchResult): SymbolOption => ({
  symbol: normalizeSymbol(item.symbol),
  name: item.name,
  exchange: item.exchange,
  currency: item.currency,
  market: item.market,
  source: 'remote'
})

export function SymbolAutocomplete({
  value,
  market,
  onChange,
  label,
  required,
  error,
  helperText,
  autoFocus
}: SymbolAutocompleteProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState(value)
  const [debouncedQuery, setDebouncedQuery] = useState(value)
  const [recentSnapshot, setRecentSnapshot] = useState<string[]>(() => loadRecentSymbols())

  const normalizedQuery = normalizeSymbol(debouncedQuery)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, 250)
    return () => window.clearTimeout(timeoutId)
  }, [query])

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  const { data: remoteMatches = [], isFetching } = useQuery({
    queryKey: ['symbols-search', normalizedQuery, market],
    queryFn: () => searchSymbols({ q: normalizedQuery, market }),
    enabled: normalizedQuery.length > 0,
    staleTime: 60_000
  })

  const options = useMemo(() => {
    const recentOptions: SymbolOption[] = recentSnapshot
      .filter((entry) => !normalizedQuery || entry.includes(normalizedQuery))
      .map((entry) => ({ symbol: entry, source: 'recent' }))

    const remoteOptions = remoteMatches
      .map(mapSearchResultToOption)
      .filter((option) => option.symbol)

    const deduped = new Map<string, SymbolOption>()
    ;[...recentOptions, ...remoteOptions].forEach((option) => {
      if (!deduped.has(option.symbol)) {
        deduped.set(option.symbol, option)
      }
    })

    return Array.from(deduped.values()).slice(0, 20)
  }, [normalizedQuery, recentSnapshot, remoteMatches])

  const selected = value ? options.find((option) => option.symbol === normalizeSymbol(value)) ?? null : null

  return (
    <Autocomplete<SymbolOption, false, false, true>
      freeSolo
      options={options}
      value={selected || (value ? normalizeSymbol(value) : null)}
      loading={isFetching}
      filterOptions={(list) => list}
      onOpen={() => setRecentSnapshot(loadRecentSymbols())}
      onInputChange={(_, inputValue, reason) => {
        if (reason === 'reset') {
          return
        }
        const normalized = inputValue.toUpperCase()
        setQuery(normalized)
        onChange(normalized)
      }}
      onChange={(_, nextValue) => {
        const symbol = typeof nextValue === 'string'
          ? normalizeSymbol(nextValue)
          : normalizeSymbol(nextValue?.symbol || '')
        setQuery(symbol)
        onChange(symbol)
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : toOptionLabel(option))}
      isOptionEqualToValue={(option, currentValue) => {
        if (typeof currentValue === 'string') {
          return option.symbol === normalizeSymbol(currentValue)
        }
        return option.symbol === currentValue.symbol
      }}
      componentsProps={{
        paper: {
          sx: {
            maxWidth: 'calc(100vw - 32px)'
          }
        }
      }}
      renderOption={(props, option) => (
        <li {...props}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" width="100%">
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>{option.symbol}</Typography>
              {(option.name || option.exchange) && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.name || ''}{option.exchange ? ` (${option.exchange})` : ''}
                </Typography>
              )}
            </Stack>
            {option.source === 'recent' && (
              <Chip size="small" variant="outlined" label={t('trades.form.symbolRecent')} />
            )}
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label || t('trades.form.symbol')}
          required={required}
          error={error}
          helperText={helperText || t('trades.form.symbolHelper')}
          placeholder="AAPL"
          autoFocus={autoFocus}
          inputProps={{
            ...params.inputProps,
            autoCapitalize: 'characters',
            autoCorrect: 'off',
            spellCheck: 'false',
            maxLength: 15
          }}
          onBlur={() => {
            const normalized = normalizeSymbol(value)
            if (normalized !== value) {
              onChange(normalized)
            }
          }}
        />
      )}
    />
  )
}
