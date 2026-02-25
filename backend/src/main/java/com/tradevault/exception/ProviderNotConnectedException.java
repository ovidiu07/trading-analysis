package com.tradevault.exception;

public class ProviderNotConnectedException extends RuntimeException {
    public static final String REASON_NO_CREDENTIALS = "NO_CREDENTIALS";
    public static final String PROVIDER_OANDA = "OANDA";

    private final String provider;
    private final String reason;
    private final String code;

    public ProviderNotConnectedException(String provider, String reason, String message) {
        super(message);
        this.provider = provider;
        this.reason = reason;
        this.code = BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED;
    }

    public static ProviderNotConnectedException oandaNoCredentials() {
        return new ProviderNotConnectedException(
                PROVIDER_OANDA,
                REASON_NO_CREDENTIALS,
                "OANDA provider is not connected"
        );
    }

    public String getProvider() {
        return provider;
    }

    public String getReason() {
        return reason;
    }

    public String getCode() {
        return code;
    }
}
