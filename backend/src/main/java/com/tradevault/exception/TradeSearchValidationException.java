package com.tradevault.exception;

public class TradeSearchValidationException extends RuntimeException {
    private final Object details;

    public TradeSearchValidationException(String message, Object details) {
        super(message);
        this.details = details;
    }

    public Object getDetails() {
        return details;
    }
}
