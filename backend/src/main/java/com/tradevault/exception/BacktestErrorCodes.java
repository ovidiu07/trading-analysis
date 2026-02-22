package com.tradevault.exception;

public final class BacktestErrorCodes {
    private BacktestErrorCodes() {
    }

    public static final String BACKTEST_PROVIDER_NOT_CONNECTED = "BACKTEST_PROVIDER_NOT_CONNECTED";
    public static final String BACKTEST_PROVIDER_NOT_CONFIGURED = "BACKTEST_PROVIDER_NOT_CONFIGURED";
    public static final String CSV_PARSE_ERROR = "CSV_PARSE_ERROR";
    public static final String CSV_MAPPING_REQUIRED = "CSV_MAPPING_REQUIRED";
    public static final String DATASET_NOT_FOUND = "DATASET_NOT_FOUND";
    public static final String UNSUPPORTED_SYMBOL_TIMEFRAME = "UNSUPPORTED_SYMBOL_TIMEFRAME";
}
