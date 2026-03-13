package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "signal_profile_recommendations")
public class SignalProfileRecommendation {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "symbol_scope", nullable = false, length = 64)
    private String symbolScope;

    @Column(nullable = false, length = 16)
    private String timeframe;

    @Column(name = "regime_scope", nullable = false, length = 32)
    private String regimeScope;

    @Column(name = "profile_id", nullable = false, length = 64)
    private String profileId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "profile_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode profileJson;

    @Column(name = "min_samples", nullable = false)
    private Integer minSamples;

    @Column(name = "sample_size", nullable = false)
    private Integer sampleSize;

    @Column(name = "recommendation_score", nullable = false, precision = 18, scale = 8)
    private BigDecimal recommendationScore;

    @Column(name = "win_rate", precision = 18, scale = 8)
    private BigDecimal winRate;

    @Column(name = "expectancy_r", precision = 18, scale = 8)
    private BigDecimal expectancyR;

    @Column(nullable = false)
    private boolean active;

    @CreationTimestamp
    @Column(name = "generated_at", nullable = false, updatable = false)
    private OffsetDateTime generatedAt;
}
