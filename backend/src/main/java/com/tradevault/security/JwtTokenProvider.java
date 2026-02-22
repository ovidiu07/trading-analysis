package com.tradevault.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtTokenProvider {
    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-expiry:${jwt.expiry:900000}}")
    private long accessValidityInMs;

    @PostConstruct
    public void init() {
        secret = Base64.getEncoder().encodeToString(secret.getBytes());
    }

    public String createAccessToken(UUID userId, String email) {
        Claims claims = Jwts.claims().setSubject(userId.toString());
        claims.put("email", email);

        Date now = new Date();
        Date validity = new Date(now.getTime() + accessValidityInMs);

        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(now)
                .setExpiration(validity)
                .signWith(SignatureAlgorithm.HS256, secret)
                .compact();
    }

    // Backward-compatible name used across legacy tests/call sites.
    public String createToken(UUID userId, String email) {
        return createAccessToken(userId, email);
    }

    public UUID validateAndGetUserId(String token) {
        Claims claims = Jwts.parser().setSigningKey(secret).parseClaimsJws(token).getBody();
        return UUID.fromString(claims.getSubject());
    }
}
