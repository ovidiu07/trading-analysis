package com.tradevault.exception;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ApiErrorResponse {
    private String error;
    private String message;
    private String hint;
    private Object details;
}
