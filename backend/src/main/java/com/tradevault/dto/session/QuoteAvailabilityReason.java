package com.tradevault.dto.session;

public enum QuoteAvailabilityReason {
    OK,
    NO_PROVIDER,
    NO_CREDENTIALS,
    DISPLAY_NOT_AUTHORIZED,
    LICENSE_REQUIRED,
    SYMBOL_NOT_SUPPORTED,
    RATE_LIMIT,
    UPSTREAM_ERROR
}
