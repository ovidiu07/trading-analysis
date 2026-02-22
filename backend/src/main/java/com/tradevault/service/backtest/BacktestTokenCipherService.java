package com.tradevault.service.backtest;

import com.tradevault.exception.BacktestDomainException;
import com.tradevault.exception.BacktestErrorCodes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class BacktestTokenCipherService {
    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_LENGTH = 12;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${backtest.token-encryption-key:}")
    private String base64Key;

    public EncryptedToken encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            throw new IllegalArgumentException("Provider token is required");
        }
        SecretKeySpec keySpec = resolveKey();
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return new EncryptedToken(iv, encrypted);
        } catch (BacktestDomainException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONFIGURED,
                    "Could not encrypt provider token",
                    "Check BACKTEST_TOKEN_ENCRYPTION_KEY server configuration.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    public String decrypt(byte[] iv, byte[] encryptedToken) {
        if (iv == null || iv.length == 0 || encryptedToken == null || encryptedToken.length == 0) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Provider token is missing",
                    "Connect your provider from Settings -> Data Providers.",
                    HttpStatus.FORBIDDEN
            );
        }
        SecretKeySpec keySpec = resolveKey();
        try {
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] decrypted = cipher.doFinal(encryptedToken);
            return new String(decrypted, java.nio.charset.StandardCharsets.UTF_8);
        } catch (BacktestDomainException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONNECTED,
                    "Stored provider token is invalid",
                    "Reconnect your provider token from Settings -> Data Providers.",
                    HttpStatus.FORBIDDEN
            );
        }
    }

    private SecretKeySpec resolveKey() {
        if (base64Key == null || base64Key.isBlank()) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONFIGURED,
                    "Provider credentials are not configured on this server",
                    "Set BACKTEST_TOKEN_ENCRYPTION_KEY in the backend environment.",
                    HttpStatus.BAD_REQUEST
            );
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(base64Key.trim());
            if (decoded.length != 16 && decoded.length != 24 && decoded.length != 32) {
                throw new IllegalArgumentException("Invalid AES key length");
            }
            return new SecretKeySpec(decoded, "AES");
        } catch (Exception ex) {
            throw new BacktestDomainException(
                    BacktestErrorCodes.BACKTEST_PROVIDER_NOT_CONFIGURED,
                    "Provider encryption key is invalid",
                    "Use a Base64-encoded AES key (16/24/32 bytes) for BACKTEST_TOKEN_ENCRYPTION_KEY.",
                    HttpStatus.BAD_REQUEST
            );
        }
    }

    public record EncryptedToken(byte[] iv, byte[] encryptedToken) {
    }
}
