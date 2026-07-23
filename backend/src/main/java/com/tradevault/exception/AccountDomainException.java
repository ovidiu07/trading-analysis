package com.tradevault.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class AccountDomainException extends RuntimeException {
    private final String code;
    private final HttpStatus status;

    public AccountDomainException(String code, HttpStatus status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
