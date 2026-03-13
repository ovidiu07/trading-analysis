package com.tradevault.domain.entity;

import com.tradevault.domain.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private Role role;

    private String baseCurrency;
    private String timezone;

    @Column(name = "theme_preference", nullable = false)
    @Builder.Default
    private String themePreference = "SYSTEM";

    @Column(name = "tradingview_webhook_enabled", nullable = false)
    @Builder.Default
    private boolean tradingviewWebhookEnabled = false;

    @Column(name = "tradingview_webhook_secret_hash")
    private String tradingviewWebhookSecretHash;

    @Column(name = "tradingview_webhook_secret_hint")
    private String tradingviewWebhookSecretHint;

    @Column(name = "tradingview_webhook_secret_rotated_at")
    private OffsetDateTime tradingviewWebhookSecretRotatedAt;

    private OffsetDateTime createdAt;
    private OffsetDateTime lastLoginAt;

    @Column(name = "email_verified_at")
    private OffsetDateTime emailVerifiedAt;

    @Column(name = "demo_enabled", nullable = false)
    @Builder.Default
    private boolean demoEnabled = true;

    @Column(name = "demo_seed_id")
    private UUID demoSeedId;

    @Column(name = "demo_removed_at")
    private OffsetDateTime demoRemovedAt;

    public boolean isVerified() {
        return emailVerifiedAt != null;
    }
}
