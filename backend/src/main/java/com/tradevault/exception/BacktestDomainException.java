package com.tradevault.exception;

import org.springframework.http.HttpStatus;

public class BacktestDomainException extends RuntimeException {
    private final String code;
    private final String hint;
    private final HttpStatus status;
    private final Object details;

    public BacktestDomainException(String code, String message, String hint, HttpStatus status) {
        this(code, message, hint, status, null);
    }

    public BacktestDomainException(String code, String message, String hint, HttpStatus status, Object details) {
        super(message);
        this.code = code;
        this.hint = hint;
        this.status = status == null ? HttpStatus.BAD_REQUEST : status;
        this.details = details;
    }

    public String getCode() {
        return code;
    }

    public String getHint() {
        return hint;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public Object getDetails() {
        return details;
    }
}
