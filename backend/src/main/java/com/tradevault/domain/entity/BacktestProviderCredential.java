package com.tradevault.domain.entity;

import com.tradevault.domain.enums.BacktestCandleSource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;
import com.tradevault.service.backtest.OandaEnvironment;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "backtest_provider_credentials")
public class BacktestProviderCredential {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestCandleSource provider;

    @Lob
    @Column(name = "encrypted_token", nullable = false, columnDefinition = "BYTEA")
    private byte[] encryptedToken;

    @Lob
    @Column(name = "token_iv", nullable = false, columnDefinition = "BYTEA")
    private byte[] tokenIv;

    @Column(name = "provider_account_id", length = 128)
    private String providerAccountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "environment", nullable = false, length = 16)
    private OandaEnvironment environment;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "instrument_capabilities", nullable = false, columnDefinition = "jsonb")
    private JsonNode instrumentCapabilities;

    @Column(name = "instrument_capabilities_refreshed_at")
    private OffsetDateTime instrumentCapabilitiesRefreshedAt;

    @Column(name = "last_tested_at")
    private OffsetDateTime lastTestedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
