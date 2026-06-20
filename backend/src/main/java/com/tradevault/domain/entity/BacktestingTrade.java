package com.tradevault.domain.entity;

import com.tradevault.domain.enums.BacktestingTradeDirection;
import com.tradevault.domain.enums.BacktestingTradeResult;
import com.tradevault.domain.enums.BacktestingTradeScope;
import com.tradevault.domain.enums.BacktestingTradeSource;
import com.tradevault.domain.enums.BacktestingGapFillStatus;
import com.tradevault.domain.enums.BacktestingGapLiquidityRelation;
import com.tradevault.domain.enums.BacktestingGapType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "backtesting_trades")
public class BacktestingTrade {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private BacktestingWorkspace workspace;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "trade_date", nullable = false)
    private LocalDate date;

    @Column(length = 16)
    private String weekday;

    @Column(name = "entry_time", nullable = false)
    private LocalTime entryTime;

    @Column(nullable = false, length = 64)
    private String instrument;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private BacktestingTradeDirection direction;

    @Column(length = 40)
    private String session;

    @Column(name = "setup_name", length = 180)
    private String setupName;

    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_source", length = 16)
    private String strategySource;

    @Column(name = "strategy_name_snapshot", length = 255)
    private String strategyNameSnapshot;

    @Column(name = "gap_present", nullable = false)
    private boolean gapPresent;

    @Enumerated(EnumType.STRING)
    @Column(name = "gap_type", length = 16)
    private BacktestingGapType gapType;

    @Column(name = "gap_timeframe", length = 40)
    private String gapTimeframe;

    @Column(name = "gap_created_at")
    private LocalTime gapCreatedAt;

    @Column(name = "gap_mitigated_at")
    private LocalTime gapMitigatedAt;

    @Column(name = "gap_high", precision = 20, scale = 8)
    private BigDecimal gapHigh;

    @Column(name = "gap_low", precision = 20, scale = 8)
    private BigDecimal gapLow;

    @Column(name = "gap_midpoint", precision = 20, scale = 8)
    private BigDecimal gapMidpoint;

    @Column(name = "gap_size_points", precision = 20, scale = 8)
    private BigDecimal gapSizePoints;

    @Column(name = "gap_size_percent", precision = 12, scale = 6)
    private BigDecimal gapSizePercent;

    @Column(name = "gap_entry_position_percent", precision = 12, scale = 6)
    private BigDecimal gapEntryPositionPercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "gap_fill_status", length = 32)
    private BacktestingGapFillStatus gapFillStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "gap_relation_to_liquidity", length = 48)
    private BacktestingGapLiquidityRelation gapRelationToLiquidity;

    @Column(name = "gap_confluence_notes", columnDefinition = "TEXT")
    private String gapConfluenceNotes;

    @Column(name = "risk_percent", precision = 10, scale = 4)
    private BigDecimal riskPercent;

    @Column(name = "planned_rr", precision = 10, scale = 4)
    private BigDecimal plannedRR;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestingTradeResult result;

    @Column(name = "pnl_r", nullable = false, precision = 12, scale = 4)
    private BigDecimal pnlR;

    @Column(name = "context_timeframe", length = 40)
    private String contextTimeframe;

    @Column(name = "execution_timeframe", length = 40)
    private String executionTimeframe;

    @Column(name = "entry_timeframe", length = 40)
    private String entryTimeframe;

    @Column(name = "tags", columnDefinition = "TEXT")
    private String tagsJson;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestingTradeSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_scope", nullable = false, length = 16)
    private BacktestingTradeScope tradeScope;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void defaults() {
        if (source == null) source = BacktestingTradeSource.MANUAL;
        if (tradeScope == null) tradeScope = BacktestingTradeScope.BACKTEST;
        if (date != null) {
            DayOfWeek day = date.getDayOfWeek();
            weekday = day.name().substring(0, 1) + day.name().substring(1).toLowerCase(Locale.ROOT);
        }
    }
}
