package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.BacktestExitReason;
import com.tradevault.domain.enums.BacktestOrderType;
import com.tradevault.domain.enums.Direction;
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
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
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
@Table(name = "backtest_trades")
public class BacktestTrade {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private BacktestRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "setup_id")
    private BacktestSetup setup;

    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_version_id")
    private UUID strategyVersionId;

    @Column(name = "context_snapshot_id")
    private UUID contextSnapshotId;

    @Column(nullable = false, length = 64)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false, length = 16)
    private BacktestOrderType orderType;

    @Column(name = "entry_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal entryPrice;

    @Column(name = "stop_loss_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal stopLossPrice;

    @Column(name = "take_profit_price", precision = 18, scale = 8)
    private BigDecimal takeProfitPrice;

    @Column(name = "risk_amount", precision = 18, scale = 4)
    private BigDecimal riskAmount;

    @Column(name = "invalidation_text", columnDefinition = "TEXT")
    private String invalidationText;

    @Column(name = "requested_at", nullable = false)
    private OffsetDateTime requestedAt;

    @Column(name = "entry_time")
    private OffsetDateTime entryTime;

    @Column(name = "exit_time")
    private OffsetDateTime exitTime;

    @Column(nullable = false)
    private boolean filled;

    @Column(name = "fill_status", length = 16)
    private String fillStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "exit_reason", length = 16)
    private BacktestExitReason exitReason;

    private Boolean win;

    @Column(name = "break_even", nullable = false)
    private boolean breakEven;

    @Column(name = "r_multiple", precision = 18, scale = 8)
    private BigDecimal rMultiple;

    @Column(name = "mae_price", precision = 18, scale = 8)
    private BigDecimal maePrice;

    @Column(name = "mfe_price", precision = 18, scale = 8)
    private BigDecimal mfePrice;

    @Column(name = "mae_r", precision = 18, scale = 8)
    private BigDecimal maeR;

    @Column(name = "mfe_r", precision = 18, scale = 8)
    private BigDecimal mfeR;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "duration_bars")
    private Integer durationBars;

    @Column(name = "duration_sec")
    private Integer durationSec;

    @Column(name = "time_to_plus_1r_minutes")
    private Integer timeToPlus1RMinutes;

    @Column(name = "time_to_plus_1r_bars")
    private Integer timeToPlus1RBars;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode metadataJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode evidenceJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersistDefaults() {
        if (metadataJson == null) {
            metadataJson = JsonNodeFactory.instance.objectNode();
        }
        if (evidenceJson == null) {
            evidenceJson = JsonNodeFactory.instance.objectNode();
        }
    }
}
