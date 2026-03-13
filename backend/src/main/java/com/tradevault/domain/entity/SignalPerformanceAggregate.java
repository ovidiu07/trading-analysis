package com.tradevault.domain.entity;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.SignalRegime;
import com.tradevault.domain.enums.SignalSetupType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "signal_performance_aggregates")
public class SignalPerformanceAggregate {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 64)
    private String symbol;

    @Column(nullable = false, length = 16)
    private String timeframe;

    @Column(name = "parameter_profile_id", nullable = false, length = 64)
    private String parameterProfileId;

    @Enumerated(EnumType.STRING)
    @Column(name = "setup_type", nullable = false, length = 48)
    private SignalSetupType setupType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private SignalRegime regime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Direction direction;

    @Column(name = "sample_size", nullable = false)
    private Integer sampleSize;

    @Column(name = "win_rate", nullable = false, precision = 18, scale = 8)
    private BigDecimal winRate;

    @Column(name = "avg_pnl_r", nullable = false, precision = 18, scale = 8)
    private BigDecimal avgPnlR;

    @Column(name = "expectancy_r", nullable = false, precision = 18, scale = 8)
    private BigDecimal expectancyR;

    @Column(name = "max_drawdown_r", nullable = false, precision = 18, scale = 8)
    private BigDecimal maxDrawdownR;

    @Column(name = "avg_confidence_score", nullable = false, precision = 18, scale = 8)
    private BigDecimal avgConfidenceScore;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
