package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AccountScopeMetadata {
    private String mode;
    private List<UUID> accountIds;
    private List<String> accountNames;
    private List<String> reportingCurrencies;
    private String reportingCurrency;
    private boolean monetaryAnalyticsAvailable;
}
