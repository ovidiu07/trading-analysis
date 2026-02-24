package com.tradevault.domain.entity;

import com.tradevault.domain.enums.BacktestRunStatus;
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
import org.hibernate.annotations.CreationTimestamp;
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
@Table(name = "backtest_runs")
public class BacktestRun {
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

    @Column(name = "range_from", nullable = false)
    private OffsetDateTime rangeFrom;

    @Column(name = "range_to", nullable = false)
    private OffsetDateTime rangeTo;

    @Column(name = "session_window", length = 64)
    private String sessionWindow;

    @Column(precision = 18, scale = 8)
    private BigDecimal spread;

    @Column(precision = 18, scale = 8)
    private BigDecimal slippage;

    @Column(nullable = false, length = 32)
    private String provider;

    @Column(name = "source_id", length = 128)
    private String sourceId;

    @Column(name = "dataset_id")
    private UUID datasetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_set_id")
    private BacktestDatasetSet datasetSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_config_id")
    private BacktestStrategyConfig strategyConfig;

    @Column(name = "from_utc")
    private OffsetDateTime fromUtc;

    @Column(name = "to_utc")
    private OffsetDateTime toUtc;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private BacktestRunStatus status;

    @Column(name = "candle_count", nullable = false)
    private Integer candleCount;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "error_msg", columnDefinition = "TEXT")
    private String errorMsg;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
