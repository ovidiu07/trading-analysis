package com.tradevault.service;

import com.tradevault.domain.enums.Market;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FuturesContractMetadataService {
    private static final Pattern EXPIRY_SUFFIX_PATTERN = Pattern.compile("^([A-Z]+)([FGHJKMNQUVXZ])(\\d{1,4})$");

    private static final Map<String, FuturesContractMetadata> CONTRACTS = Map.ofEntries(
            Map.entry("MNQ", new FuturesContractMetadata("MNQ", "Micro E-mini Nasdaq-100", bd("2"), bd("0.25"), bd("0.50"))),
            Map.entry("NQ", new FuturesContractMetadata("NQ", "E-mini Nasdaq-100", bd("20"), bd("0.25"), bd("5.00"))),
            Map.entry("MES", new FuturesContractMetadata("MES", "Micro E-mini S&P 500", bd("5"), bd("0.25"), bd("1.25"))),
            Map.entry("ES", new FuturesContractMetadata("ES", "E-mini S&P 500", bd("50"), bd("0.25"), bd("12.50"))),
            Map.entry("M2K", new FuturesContractMetadata("M2K", "Micro E-mini Russell 2000", bd("5"), bd("0.10"), bd("0.50"))),
            Map.entry("RTY", new FuturesContractMetadata("RTY", "E-mini Russell 2000", bd("50"), bd("0.10"), bd("5.00"))),
            Map.entry("MYM", new FuturesContractMetadata("MYM", "Micro E-mini Dow", bd("0.50"), bd("1"), bd("0.50"))),
            Map.entry("YM", new FuturesContractMetadata("YM", "E-mini Dow", bd("5"), bd("1"), bd("5.00"))),
            Map.entry("MCL", new FuturesContractMetadata("MCL", "Micro WTI Crude Oil", bd("100"), bd("0.01"), bd("1.00"))),
            Map.entry("CL", new FuturesContractMetadata("CL", "WTI Crude Oil", bd("1000"), bd("0.01"), bd("10.00"))),
            Map.entry("MGC", new FuturesContractMetadata("MGC", "Micro Gold", bd("10"), bd("0.10"), bd("1.00"))),
            Map.entry("GC", new FuturesContractMetadata("GC", "Gold", bd("100"), bd("0.10"), bd("10.00")))
    );

    public Optional<FuturesContractMetadata> resolve(String symbol) {
        String root = normalizeRoot(symbol);
        if (root == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(CONTRACTS.get(root));
    }

    public BigDecimal resolveContractMultiplier(Market market,
                                                String symbol,
                                                BigDecimal requestedMultiplier,
                                                BigDecimal existingMultiplier) {
        if (requestedMultiplier != null && requestedMultiplier.compareTo(BigDecimal.ZERO) > 0) {
            return requestedMultiplier;
        }
        if (market == Market.FUTURES) {
            Optional<BigDecimal> metadataMultiplier = resolve(symbol).map(FuturesContractMetadata::contractMultiplier);
            if (metadataMultiplier.isPresent()) {
                return metadataMultiplier.get();
            }
        }
        if (existingMultiplier != null && existingMultiplier.compareTo(BigDecimal.ZERO) > 0) {
            return existingMultiplier;
        }
        return BigDecimal.ONE;
    }

    private String normalizeRoot(String symbol) {
        if (symbol == null) {
            return null;
        }
        String normalized = symbol.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (normalized.isEmpty()) {
            return null;
        }
        if (CONTRACTS.containsKey(normalized)) {
            return normalized;
        }
        Matcher matcher = EXPIRY_SUFFIX_PATTERN.matcher(normalized);
        if (matcher.matches()) {
            String candidate = matcher.group(1);
            if (CONTRACTS.containsKey(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(Objects.requireNonNull(value));
    }

    public record FuturesContractMetadata(String root,
                                          String displayName,
                                          BigDecimal contractMultiplier,
                                          BigDecimal tickSize,
                                          BigDecimal tickValue) {}
}
