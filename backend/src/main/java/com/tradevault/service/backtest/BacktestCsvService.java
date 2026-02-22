package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.BacktestCsvMapping;
import com.tradevault.domain.entity.BacktestCsvUpload;
import com.tradevault.domain.entity.BacktestDataset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.dto.backtest.CsvColumnMappingRequest;
import com.tradevault.dto.backtest.CsvIngestRequest;
import com.tradevault.dto.backtest.CsvIngestResponse;
import com.tradevault.dto.backtest.CsvUploadResponse;
import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import com.tradevault.repository.BacktestCsvMappingRepository;
import com.tradevault.repository.BacktestCsvUploadRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BacktestCsvService {
    private static final List<String> TIME_HEADERS = List.of("time", "timestamp", "date", "datetime", "utc");
    private static final List<String> OPEN_HEADERS = List.of("open", "o");
    private static final List<String> HIGH_HEADERS = List.of("high", "h");
    private static final List<String> LOW_HEADERS = List.of("low", "l");
    private static final List<String> CLOSE_HEADERS = List.of("close", "c", "last", "price");
    private static final List<String> VOLUME_HEADERS = List.of("volume", "vol", "tick_volume");
    private static final List<DateTimeFormatter> LOCAL_DATE_TIME_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm")
    );

    private final BacktestCsvUploadRepository uploadRepository;
    private final BacktestCsvMappingRepository mappingRepository;
    private final BacktestDatasetService datasetService;
    private final CandleChunkStoreService candleChunkStoreService;
    private final ObjectMapper objectMapper;

    @Value("${backtest.csv.max-upload-mb:25}")
    private int csvMaxUploadMb;

    @Transactional
    public CsvUploadResponse upload(User user, MultipartFile file) {
        byte[] payload = readAndValidate(file);
        assertBinaryPayload(payload, "CSV upload payload");
        ParseResult preview = parseCsv(
                payload,
                resolveFileName(file),
                null,
                null,
                findSavedMapping(user.getId(), payload),
                false
        );

        BacktestCsvUpload upload = BacktestCsvUpload.builder()
                .user(user)
                .originalFileName(resolveFileName(file))
                .contentType(file.getContentType())
                .fileSizeBytes(payload.length)
                .filePayload(payload)
                .headerSignature(preview.headerSignature())
                .detectedJson(writeDetected(preview))
                .build();
        BacktestCsvUpload saved = uploadRepository.save(upload);

        return toUploadResponse(saved.getId(), saved.getOriginalFileName(), preview);
    }

    @Transactional
    public CsvIngestResponse ingest(User user, UUID fileId, CsvIngestRequest request) {
        BacktestCsvUpload upload = uploadRepository.findByIdAndUser_Id(fileId, user.getId())
                .orElseThrow(() -> new BacktestDomainException(
                        BacktestErrorCodes.DATASET_NOT_FOUND,
                        "Uploaded CSV file was not found",
                        "Upload the CSV file again before ingesting.",
                        HttpStatus.NOT_FOUND
                ));

        CsvColumnMappingRequest requestMapping = request == null ? null : request.getMapping();
        assertBinaryPayload(upload.getFilePayload(), "Stored CSV payload");
        CsvColumnMappingRequest savedMapping = findSavedMapping(user.getId(), upload.getFilePayload());
        ParseResult parsed = parseCsv(
                upload.getFilePayload(),
                upload.getOriginalFileName(),
                requestMapping,
                request == null ? null : request.getTimezone(),
                savedMapping,
                true
        );

        if (parsed.candles().isEmpty()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "No valid OHLC rows were found in the CSV file",
                    "Check timestamp/price columns and try with an explicit mapping.",
                    HttpStatus.BAD_REQUEST
            );
        }

        CsvColumnMappingRequest mappingToSave = parsed.mapping();
        if (mappingToSave != null && upload.getHeaderSignature() != null) {
            upsertMapping(user, upload.getHeaderSignature(), mappingToSave);
        }

        BacktestTimeframe timeframe = resolveTimeframe(
                request == null ? null : request.getTimeframe(),
                parsed.timeframe() == null ? null : parsed.timeframe().name()
        );

        String symbolDisplay = resolveSymbolDisplay(
                request == null ? null : request.getSymbol(),
                parsed.detectedSymbol(),
                upload.getOriginalFileName()
        );
        String symbolCanonical = canonicalizeSymbol(symbolDisplay);
        String sourceId = UUID.randomUUID().toString();

        List<CanonicalCandle> canonical = parsed.candles().stream()
                .map(item -> new CanonicalCandle(
                        BacktestCandleSource.CSV,
                        sourceId,
                        symbolCanonical,
                        symbolDisplay,
                        timeframe,
                        item.tsUtc(),
                        item.open(),
                        item.high(),
                        item.low(),
                        item.close(),
                        item.volume()
                ))
                .toList();

        candleChunkStoreService.saveCandles(
                user.getId(),
                BacktestCandleSource.CSV,
                sourceId,
                symbolCanonical,
                symbolDisplay,
                timeframe,
                canonical
        );

        String datasetName = request == null ? null : request.getDatasetName();
        BacktestDataset dataset = datasetService.upsertDataset(
                user,
                BacktestCandleSource.CSV,
                sourceId,
                datasetName == null || datasetName.isBlank() ? upload.getOriginalFileName() : datasetName,
                symbolCanonical,
                symbolDisplay,
                timeframe,
                parsed.from(),
                parsed.to(),
                canonical.size(),
                parsed.warnings()
        );

        return CsvIngestResponse.builder()
                .dataset(datasetService.toResponse(dataset))
                .warnings(parsed.warnings())
                .build();
    }

    private byte[] readAndValidate(MultipartFile file) {
        String fileName = resolveFileName(file);
        if (file == null || file.isEmpty()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "CSV file is empty",
                    "Select a valid CSV file and retry.",
                    HttpStatus.BAD_REQUEST
            );
        }
        long maxBytes = Math.max(1, csvMaxUploadMb) * 1024L * 1024L;
        if (file.getSize() > maxBytes) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "CSV file is too large",
                    "Use a file up to %d MB or split it by date range.".formatted(Math.max(1, csvMaxUploadMb)),
                    HttpStatus.BAD_REQUEST
            );
        }
        if (!fileName.toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "Unsupported file format",
                    "Upload a .csv file exported from TradingView or your data source.",
                    HttpStatus.BAD_REQUEST
            );
        }
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "Could not read CSV file",
                    "Retry the upload and ensure the file is accessible.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private void assertBinaryPayload(byte[] payload, String fieldLabel) {
        if (payload == null || payload.length == 0) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "%s is empty".formatted(fieldLabel),
                    "Upload the CSV again and retry ingesting.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private ParseResult parseCsv(byte[] payload,
                                 String fileName,
                                 CsvColumnMappingRequest requestedMapping,
                                 String timezoneOverride,
                                 CsvColumnMappingRequest savedMapping,
                                 boolean strict) {
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .build();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new ByteArrayInputStream(payload), StandardCharsets.UTF_8));
             CSVParser parser = new CSVParser(reader, format)) {
            Map<String, Integer> headerMap = parser.getHeaderMap();
            if (headerMap == null || headerMap.isEmpty()) {
                throw new BacktestDomainException(
                        BacktestErrorCodes.CSV_PARSE_ERROR,
                        "CSV header row is missing",
                        "Add a header row with time/open/high/low/close columns.",
                        HttpStatus.BAD_REQUEST
                );
            }
            List<String> headers = new ArrayList<>(headerMap.keySet());
            String headerSignature = signatureForHeaders(headers);

            CsvColumnMappingRequest mapping = resolveMapping(headers, requestedMapping, savedMapping);
            boolean mappingRequired = mapping == null;

            if (strict && mappingRequired) {
                throw mappingRequiredError(headers, requestedMapping);
            }

            List<CandleRow> candles = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            String detectedSymbol = null;
            OffsetDateTime previousTs = null;
            boolean unsorted = false;
            int skippedRows = 0;

            for (CSVRecord row : parser) {
                if (mapping == null) {
                    break;
                }
                CandleRow parsed = parseRow(row, mapping, timezoneOverride);
                if (parsed == null) {
                    skippedRows++;
                    continue;
                }
                candles.add(parsed);
                if (previousTs != null && parsed.tsUtc().isBefore(previousTs)) {
                    unsorted = true;
                }
                previousTs = parsed.tsUtc();

                if (detectedSymbol == null) {
                    detectedSymbol = detectSymbolFromRow(row);
                }
            }

            if (unsorted) {
                warnings.add("Detected unsorted timestamps. Data was normalized in ascending order.");
            }
            if (skippedRows > 0) {
                warnings.add("Skipped %d invalid rows during CSV parsing.".formatted(skippedRows));
            }

            Map<OffsetDateTime, CandleRow> deduped = new LinkedHashMap<>();
            for (CandleRow candle : candles) {
                deduped.put(candle.tsUtc(), candle);
            }
            int duplicates = candles.size() - deduped.size();
            if (duplicates > 0) {
                warnings.add("Removed %d duplicate timestamps.".formatted(duplicates));
            }

            List<CandleRow> normalized = deduped.values().stream()
                    .sorted(Comparator.comparing(CandleRow::tsUtc))
                    .toList();

            BacktestTimeframe inferredTimeframe = inferTimeframe(normalized);
            if (inferredTimeframe != null) {
                long gapCount = countGaps(normalized, inferredTimeframe);
                if (gapCount > 0) {
                    warnings.add("Detected %d timestamp gaps for %s data.".formatted(gapCount, inferredTimeframe.name()));
                }
            }

            OffsetDateTime from = normalized.isEmpty() ? null : normalized.get(0).tsUtc();
            OffsetDateTime to = normalized.isEmpty() ? null : normalized.get(normalized.size() - 1).tsUtc();
            String symbol = detectedSymbol != null ? detectedSymbol : symbolFromFileName(fileName);

            return new ParseResult(
                    headers,
                    headerSignature,
                    mappingRequired,
                    mapping,
                    symbol,
                    inferredTimeframe,
                    from,
                    to,
                    warnings,
                    normalized
            );
        } catch (BacktestDomainException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.CSV_PARSE_ERROR,
                    "Could not parse CSV content",
                    "Check CSV delimiters and column formats.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    private CsvColumnMappingRequest resolveMapping(List<String> headers,
                                                   CsvColumnMappingRequest requested,
                                                   CsvColumnMappingRequest saved) {
        if (requested != null) {
            return validateRequestedMapping(headers, requested);
        }
        if (saved != null) {
            CsvColumnMappingRequest validSaved = validateRequestedMapping(headers, saved);
            if (validSaved != null) {
                return validSaved;
            }
        }
        return autoDetectMapping(headers);
    }

    private CsvColumnMappingRequest validateRequestedMapping(List<String> headers, CsvColumnMappingRequest mapping) {
        if (mapping == null) {
            return null;
        }
        Set<String> available = new LinkedHashSet<>();
        for (String header : headers) {
            available.add(header.toLowerCase(Locale.ROOT));
        }
        if (!available.contains(normalizeHeader(mapping.getTimeColumn()))
                || !available.contains(normalizeHeader(mapping.getOpenColumn()))
                || !available.contains(normalizeHeader(mapping.getHighColumn()))
                || !available.contains(normalizeHeader(mapping.getLowColumn()))
                || !available.contains(normalizeHeader(mapping.getCloseColumn()))) {
            return null;
        }
        CsvColumnMappingRequest normalized = new CsvColumnMappingRequest();
        normalized.setTimeColumn(resolveHeaderName(headers, mapping.getTimeColumn()));
        normalized.setOpenColumn(resolveHeaderName(headers, mapping.getOpenColumn()));
        normalized.setHighColumn(resolveHeaderName(headers, mapping.getHighColumn()));
        normalized.setLowColumn(resolveHeaderName(headers, mapping.getLowColumn()));
        normalized.setCloseColumn(resolveHeaderName(headers, mapping.getCloseColumn()));
        normalized.setVolumeColumn(resolveOptionalHeader(headers, mapping.getVolumeColumn()));
        normalized.setTimezone(mapping.getTimezone());
        return normalized;
    }

    private CsvColumnMappingRequest autoDetectMapping(List<String> headers) {
        String time = detectHeader(headers, TIME_HEADERS);
        String open = detectHeader(headers, OPEN_HEADERS);
        String high = detectHeader(headers, HIGH_HEADERS);
        String low = detectHeader(headers, LOW_HEADERS);
        String close = detectHeader(headers, CLOSE_HEADERS);
        String volume = detectHeader(headers, VOLUME_HEADERS);

        if (time == null || open == null || high == null || low == null || close == null) {
            return null;
        }

        CsvColumnMappingRequest mapping = new CsvColumnMappingRequest();
        mapping.setTimeColumn(time);
        mapping.setOpenColumn(open);
        mapping.setHighColumn(high);
        mapping.setLowColumn(low);
        mapping.setCloseColumn(close);
        mapping.setVolumeColumn(volume);
        return mapping;
    }

    private CandleRow parseRow(CSVRecord row, CsvColumnMappingRequest mapping, String timezoneOverride) {
        try {
            String tz = timezoneOverride;
            if (tz == null || tz.isBlank()) {
                tz = mapping.getTimezone();
            }
            OffsetDateTime ts = parseTimestamp(row.get(mapping.getTimeColumn()), tz);
            BigDecimal open = parseDecimal(row.get(mapping.getOpenColumn()));
            BigDecimal high = parseDecimal(row.get(mapping.getHighColumn()));
            BigDecimal low = parseDecimal(row.get(mapping.getLowColumn()));
            BigDecimal close = parseDecimal(row.get(mapping.getCloseColumn()));
            BigDecimal volume = null;
            if (mapping.getVolumeColumn() != null && !mapping.getVolumeColumn().isBlank() && row.isMapped(mapping.getVolumeColumn())) {
                volume = parseDecimal(row.get(mapping.getVolumeColumn()));
            }
            if (ts == null || open == null || high == null || low == null || close == null) {
                return null;
            }
            return new CandleRow(ts, open, high, low, close, volume);
        } catch (Exception ex) {
            return null;
        }
    }

    private OffsetDateTime parseTimestamp(String raw, String timezoneRaw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();

        if (value.matches("^-?\\d{10,17}$")) {
            try {
                long epoch = Long.parseLong(value);
                if (value.length() >= 13) {
                    return OffsetDateTime.ofInstant(java.time.Instant.ofEpochMilli(epoch), ZoneOffset.UTC);
                }
                return OffsetDateTime.ofInstant(java.time.Instant.ofEpochSecond(epoch), ZoneOffset.UTC);
            } catch (Exception ignored) {
                // continue with other parsers
            }
        }

        try {
            return OffsetDateTime.parse(value).withOffsetSameInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            // continue
        }

        try {
            LocalDateTime local = LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            return local.atZone(resolveZone(timezoneRaw)).withZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime();
        } catch (DateTimeParseException ignored) {
            // continue
        }

        for (DateTimeFormatter formatter : LOCAL_DATE_TIME_FORMATS) {
            try {
                LocalDateTime local = LocalDateTime.parse(value, formatter);
                return local.atZone(resolveZone(timezoneRaw)).withZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime();
            } catch (DateTimeParseException ignored) {
                // continue
            }
        }

        try {
            LocalDate date = LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
            return date.atStartOfDay(resolveZone(timezoneRaw)).withZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private ZoneId resolveZone(String timezoneRaw) {
        if (timezoneRaw == null || timezoneRaw.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timezoneRaw.trim());
        } catch (Exception ex) {
            return ZoneOffset.UTC;
        }
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim();
        if (normalized.isBlank()) {
            return null;
        }
        normalized = normalized.replace(" ", "");
        if (normalized.contains(",") && !normalized.contains(".")) {
            normalized = normalized.replace(',', '.');
        } else if (normalized.contains(",") && normalized.contains(".")) {
            normalized = normalized.replace(",", "");
        }
        try {
            return new BigDecimal(normalized);
        } catch (Exception ex) {
            return null;
        }
    }

    private String detectHeader(List<String> headers, List<String> candidates) {
        for (String candidate : candidates) {
            for (String header : headers) {
                if (normalizeHeader(header).equals(candidate)) {
                    return header;
                }
            }
        }
        for (String candidate : candidates) {
            for (String header : headers) {
                if (normalizeHeader(header).contains(candidate)) {
                    return header;
                }
            }
        }
        return null;
    }

    private long countGaps(List<CandleRow> candles, BacktestTimeframe timeframe) {
        if (candles.size() < 2) {
            return 0;
        }
        long expectedSeconds = timeframe.duration().toSeconds();
        long threshold = Math.max(expectedSeconds + 1, Math.round(expectedSeconds * 1.5));
        long gaps = 0;
        OffsetDateTime previous = candles.get(0).tsUtc();
        for (int i = 1; i < candles.size(); i++) {
            OffsetDateTime current = candles.get(i).tsUtc();
            long diff = java.time.Duration.between(previous, current).toSeconds();
            if (diff > threshold) {
                gaps++;
            }
            previous = current;
        }
        return gaps;
    }

    private BacktestTimeframe inferTimeframe(List<CandleRow> candles) {
        if (candles.size() < 2) {
            return null;
        }
        List<Long> diffs = new ArrayList<>();
        OffsetDateTime previous = candles.get(0).tsUtc();
        for (int i = 1; i < candles.size(); i++) {
            OffsetDateTime current = candles.get(i).tsUtc();
            long seconds = java.time.Duration.between(previous, current).toSeconds();
            if (seconds > 0) {
                diffs.add(seconds);
            }
            previous = current;
        }
        if (diffs.isEmpty()) {
            return null;
        }
        diffs.sort(Long::compareTo);
        long median = diffs.get(diffs.size() / 2);

        BacktestTimeframe closest = null;
        long closestDistance = Long.MAX_VALUE;
        for (BacktestTimeframe candidate : BacktestTimeframe.values()) {
            long distance = Math.abs(candidate.duration().toSeconds() - median);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = candidate;
            }
        }
        return closest;
    }

    private BacktestDomainException mappingRequiredError(List<String> headers, CsvColumnMappingRequest attempted) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("headers", headers);
        if (attempted != null) {
            details.put("mapping", attempted);
        }
        return new BacktestDomainException(
                BacktestErrorCodes.CSV_MAPPING_REQUIRED,
                "CSV column mapping is required",
                "Map time/open/high/low/close columns before ingesting this file.",
                HttpStatus.BAD_REQUEST,
                details
        );
    }

    private String detectSymbolFromRow(CSVRecord row) {
        for (String candidate : List.of("symbol", "ticker", "instrument", "pair")) {
            for (String header : row.toMap().keySet()) {
                if (normalizeHeader(header).contains(candidate)) {
                    String value = row.get(header);
                    if (value != null && !value.isBlank()) {
                        return value.trim().toUpperCase(Locale.ROOT);
                    }
                }
            }
        }
        return null;
    }

    private String symbolFromFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "CSV:UNKNOWN";
        }
        String base = fileName;
        int dot = base.lastIndexOf('.');
        if (dot > 0) {
            base = base.substring(0, dot);
        }
        String normalized = base.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
        if (normalized.isBlank()) {
            return "CSV:UNKNOWN";
        }
        return "CSV:" + normalized;
    }

    private String resolveSymbolDisplay(String requestSymbol, String detectedSymbol, String fileName) {
        if (requestSymbol != null && !requestSymbol.isBlank()) {
            return requestSymbol.trim().toUpperCase(Locale.ROOT);
        }
        if (detectedSymbol != null && !detectedSymbol.isBlank()) {
            return detectedSymbol.trim().toUpperCase(Locale.ROOT);
        }
        return symbolFromFileName(fileName);
    }

    private String canonicalizeSymbol(String symbolDisplay) {
        String normalized = symbolDisplay == null ? "UNKNOWN" : symbolDisplay.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains(":")) {
            normalized = normalized.substring(normalized.indexOf(':') + 1);
        }
        normalized = normalized.replaceAll("[^A-Z0-9]", "");
        return normalized.isBlank() ? "UNKNOWN" : normalized;
    }

    private BacktestTimeframe resolveTimeframe(String requested, String detected) {
        if (requested != null && !requested.isBlank()) {
            try {
                return BacktestTimeframe.from(requested);
            } catch (Exception ex) {
                throw new BacktestDomainException(
                        BacktestErrorCodes.UNSUPPORTED_SYMBOL_TIMEFRAME,
                        "Unsupported timeframe: " + requested,
                        "Supported values are M1, M5, M15, H1, D1.",
                        HttpStatus.BAD_REQUEST
                );
            }
        }
        if (detected != null && !detected.isBlank()) {
            try {
                return BacktestTimeframe.from(detected);
            } catch (Exception ignored) {
                // fallback below
            }
        }
        return BacktestTimeframe.M1;
    }

    private CsvColumnMappingRequest findSavedMapping(UUID userId, byte[] payload) {
        String signature = signatureForHeaders(extractHeaders(payload));
        if (signature == null) {
            return null;
        }
        return mappingRepository.findByUser_IdAndHeaderSignature(userId, signature)
                .map(this::toMappingRequest)
                .orElse(null);
    }

    private List<String> extractHeaders(byte[] payload) {
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new ByteArrayInputStream(payload), StandardCharsets.UTF_8));
             CSVParser parser = new CSVParser(reader, format)) {
            Map<String, Integer> headers = parser.getHeaderMap();
            return headers == null ? List.of() : new ArrayList<>(headers.keySet());
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String signatureForHeaders(List<String> headers) {
        if (headers == null || headers.isEmpty()) {
            return null;
        }
        try {
            String normalized = headers.stream()
                    .map(this::normalizeHeader)
                    .sorted()
                    .reduce((left, right) -> left + "|" + right)
                    .orElse("");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeHeader(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private String resolveHeaderName(List<String> headers, String requested) {
        String wanted = normalizeHeader(requested);
        for (String header : headers) {
            if (normalizeHeader(header).equals(wanted)) {
                return header;
            }
        }
        return requested;
    }

    private String resolveOptionalHeader(List<String> headers, String requested) {
        if (requested == null || requested.isBlank()) {
            return null;
        }
        return resolveHeaderName(headers, requested);
    }

    private void upsertMapping(User user, String headerSignature, CsvColumnMappingRequest mapping) {
        BacktestCsvMapping entity = mappingRepository.findByUser_IdAndHeaderSignature(user.getId(), headerSignature)
                .orElseGet(() -> BacktestCsvMapping.builder()
                        .user(user)
                        .headerSignature(headerSignature)
                        .build());
        entity.setTimeColumn(mapping.getTimeColumn());
        entity.setOpenColumn(mapping.getOpenColumn());
        entity.setHighColumn(mapping.getHighColumn());
        entity.setLowColumn(mapping.getLowColumn());
        entity.setCloseColumn(mapping.getCloseColumn());
        entity.setVolumeColumn(mapping.getVolumeColumn());
        entity.setTimezone(mapping.getTimezone());
        mappingRepository.save(entity);
    }

    private CsvColumnMappingRequest toMappingRequest(BacktestCsvMapping mapping) {
        CsvColumnMappingRequest request = new CsvColumnMappingRequest();
        request.setTimeColumn(mapping.getTimeColumn());
        request.setOpenColumn(mapping.getOpenColumn());
        request.setHighColumn(mapping.getHighColumn());
        request.setLowColumn(mapping.getLowColumn());
        request.setCloseColumn(mapping.getCloseColumn());
        request.setVolumeColumn(mapping.getVolumeColumn());
        request.setTimezone(mapping.getTimezone());
        return request;
    }

    private JsonNode writeDetected(ParseResult parsed) {
        ObjectNode node = objectMapper.createObjectNode();
        ArrayNode headers = node.putArray("headers");
        parsed.headers().forEach(headers::add);
        node.put("mappingRequired", parsed.mappingRequired());
        if (parsed.mapping() != null) {
            node.set("mapping", objectMapper.valueToTree(parsed.mapping()));
        }
        node.put("detectedSymbol", parsed.detectedSymbol());
        node.put("detectedTimeframe", parsed.timeframe() == null ? null : parsed.timeframe().name());
        node.put("dataFrom", parsed.from() == null ? null : parsed.from().toString());
        node.put("dataTo", parsed.to() == null ? null : parsed.to().toString());
        ArrayNode warnings = node.putArray("warnings");
        parsed.warnings().forEach(warnings::add);
        return node;
    }

    private CsvUploadResponse toUploadResponse(UUID fileId, String fileName, ParseResult parsed) {
        return CsvUploadResponse.builder()
                .fileId(fileId)
                .fileName(fileName)
                .headers(parsed.headers())
                .mappingRequired(parsed.mappingRequired())
                .suggestedMapping(parsed.mapping())
                .detectedSymbol(parsed.detectedSymbol())
                .detectedTimeframe(parsed.timeframe() == null ? null : parsed.timeframe().name())
                .dataFrom(parsed.from())
                .dataTo(parsed.to())
                .warnings(parsed.warnings())
                .build();
    }

    private String resolveFileName(MultipartFile file) {
        String fileName = file == null ? null : file.getOriginalFilename();
        if (fileName == null || fileName.isBlank()) {
            return "uploaded.csv";
        }
        return fileName;
    }

    private record CandleRow(
            OffsetDateTime tsUtc,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            BigDecimal volume
    ) {
    }

    private record ParseResult(
            List<String> headers,
            String headerSignature,
            boolean mappingRequired,
            CsvColumnMappingRequest mapping,
            String detectedSymbol,
            BacktestTimeframe timeframe,
            OffsetDateTime from,
            OffsetDateTime to,
            List<String> warnings,
            List<CandleRow> candles
    ) {
    }
}
