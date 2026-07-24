package com.tradevault.service.trading212;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record Trading212ParsedReport(
        List<String> headers,
        List<Trading212ClosedPosition> closedPositions,
        List<SourceRow> rows,
        List<String> unknownHeaders,
        List<String> warnings,
        String accountCurrency,
        OffsetDateTime earliestTimestamp,
        OffsetDateTime latestTimestamp
) {
    public record SourceRow(
            long rowNumber,
            String recordType,
            boolean supported,
            String positionId,
            Map<String, String> raw,
            List<String> warnings
    ) {
    }
}
