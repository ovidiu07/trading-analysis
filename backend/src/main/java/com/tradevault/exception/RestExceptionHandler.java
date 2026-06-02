package com.tradevault.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import jakarta.persistence.EntityNotFoundException;

@ControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<String> details = ex.getBindingResult().getAllErrors().stream()
                .filter(error -> error instanceof FieldError)
                .map(error -> ((FieldError) error).getField() + ": " + error.getDefaultMessage())
                .toList();
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("VALIDATION_ERROR")
                .details(details)
                .message("Validation failed")
                .build();
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String field = ex.getName();
        String received = ex.getValue() == null ? null : ex.getValue().toString();
        String expected = ex.getRequiredType() == null ? "Unknown" : ex.getRequiredType().getSimpleName();
        String message = "Invalid value for '%s'.".formatted(field);

        if (LocalDate.class.equals(ex.getRequiredType())) {
            expected = "YYYY-MM-DD";
            message = "Invalid date format for '%s' (expected YYYY-MM-DD)".formatted(field);
        }

        Map<String, String> details = new LinkedHashMap<>();
        details.put("field", field);
        details.put("expected", expected);
        details.put("received", received);

        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("VALIDATION_ERROR")
                .message(message)
                .details(details)
                .build();
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleNotReadable(HttpMessageNotReadableException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("VALIDATION_ERROR")
                .message("Malformed JSON request payload")
                .details(ex.getMostSpecificCause() == null ? null : ex.getMostSpecificCause().getMessage())
                .build();
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicate(DuplicateEmailException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("EMAIL_IN_USE")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler({AuthenticationException.class, BadCredentialsException.class})
    public ResponseEntity<ApiErrorResponse> handleAuth(AuthenticationException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("UNAUTHORIZED")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("FORBIDDEN")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("VALIDATION_ERROR")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ProviderNotConnectedException.class)
    public ResponseEntity<ApiErrorResponse> handleProviderNotConnected(ProviderNotConnectedException ex) {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("provider", ex.getProvider());
        details.put("reason", ex.getReason());
        details.put("code", ex.getCode());

        ApiErrorResponse response = ApiErrorResponse.builder()
                .error(ex.getCode())
                .message(ex.getMessage())
                .hint("Connect " + ex.getProvider() + " from Settings -> Data Providers before loading live data.")
                .details(details)
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(BacktestDomainException.class)
    public ResponseEntity<ApiErrorResponse> handleBacktestDomain(BacktestDomainException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error(ex.getCode())
                .message(ex.getMessage())
                .hint(ex.getHint())
                .details(ex.getDetails())
                .build();
        return ResponseEntity.status(ex.getStatus()).body(response);
    }

    @ExceptionHandler(TradeSearchValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleTradeSearchValidation(TradeSearchValidationException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("VALIDATION_ERROR")
                .message(ex.getMessage())
                .details(ex.getDetails())
                .build();
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(EntityNotFoundException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("NOT_FOUND")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(CaptchaVerificationException.class)
    public ResponseEntity<ApiErrorResponse> handleCaptcha(CaptchaVerificationException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("CAPTCHA_FAILED")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleRateLimit(RateLimitExceededException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("RATE_LIMITED")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ApiErrorResponse> handleEmailNotVerified(EmailNotVerifiedException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("EMAIL_NOT_VERIFIED")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(UnsupportedOperationException.class)
    public ResponseEntity<ApiErrorResponse> handleUnsupported(UnsupportedOperationException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("NOT_IMPLEMENTED")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(response);
    }

    @ExceptionHandler(TokenIssuanceException.class)
    public ResponseEntity<ApiErrorResponse> handleTokenIssuance(TokenIssuanceException ex) {
        ApiErrorResponse response = ApiErrorResponse.builder()
                .error("TOKEN_ISSUANCE_FAILED")
                .message("Token issuance failed, please retry")
                .build();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
