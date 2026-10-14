// Keep this suffix rule aligned with ReplayCsvParser.symbolFromFilename.
// A strategy title can precede the exchange; renamed files need explicit input.
export function replayInstrumentFromFilename(filename: string): string {
  const match = filename.match(/(?:^|_)(CME_MINI|CBOT_MINI|COMEX_MINI|NYMEX_MINI|[A-Z0-9]+)_([A-Z0-9][A-Z0-9.!^/-]*)_\d{4}-\d{2}-\d{2}(?:_.*)?\.csv$/i)
  return match ? `${match[1]}:${match[2]}`.toUpperCase() : ''
}
