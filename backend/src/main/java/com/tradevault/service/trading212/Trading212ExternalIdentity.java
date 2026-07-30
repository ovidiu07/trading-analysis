package com.tradevault.service.trading212;

import com.tradevault.domain.enums.TradeSource;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Component
public class Trading212ExternalIdentity {
    public String resolve(UUID accountId, Trading212ClosedPosition position) {
        String orderId = normalizeText(position.orderId());
        if (orderId != null) {
            return orderId;
        }
        String canonical = String.join("|",
                TradeSource.TRADING212_CSV.name(),
                accountId.toString(),
                normalizeLower(position.recordType()),
                normalizeUpper(position.symbol()),
                position.direction().name(),
                decimal(position.units()),
                normalizeText(position.positionId()),
                timestamp(position.openedAt()),
                timestamp(position.closedAt()),
                decimal(position.averagePrice()),
                decimal(position.closePrice()),
                decimal(position.totalResult()),
                normalizeUpper(position.accountCurrency()));
        return "sha256:" + sha256(canonical);
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private static String timestamp(OffsetDateTime value) {
        return value == null ? "" : value.toInstant().toString();
    }

    private static String normalizeLower(String value) {
        String normalized = normalizeText(value);
        return normalized == null ? "" : normalized.toLowerCase(Locale.ROOT);
    }

    private static String normalizeUpper(String value) {
        String normalized = normalizeText(value);
        return normalized == null ? "" : normalized.toUpperCase(Locale.ROOT);
    }

    private static String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
