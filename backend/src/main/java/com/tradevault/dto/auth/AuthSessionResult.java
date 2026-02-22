package com.tradevault.dto.auth;

import lombok.Value;

@Value
public class AuthSessionResult {
    AuthResponse auth;
    String refreshToken;
}
