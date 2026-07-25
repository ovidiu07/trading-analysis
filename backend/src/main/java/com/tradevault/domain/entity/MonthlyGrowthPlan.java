package com.tradevault.domain.entity;

import com.tradevault.domain.enums.GrowthTargetType;
import com.tradevault.domain.enums.SnapshotSource;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "monthly_growth_plans",
        uniqueConstraints = @UniqueConstraint(name = "ux_monthly_growth_plan", columnNames = {"account_id", "month_key"}))
public class MonthlyGrowthPlan {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;
    @Column(name = "month_key", nullable = false, length = 7)
    private String monthKey;
    @Column(name = "timezone", nullable = false, length = 80)
    private String timezone;
    @Column(name = "month_start_balance")
    private BigDecimal monthStartBalance;
    @Column(name = "month_start_equity")
    private BigDecimal monthStartEquity;
    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 40)
    private GrowthTargetType targetType;
    @Column(name = "target_basis", nullable = false, length = 40)
    private String targetBasis;
    @Column(name = "target_pct")
    private BigDecimal targetPct;
    @Column(name = "target_amount")
    private BigDecimal targetAmount;
    @Column(name = "target_r")
    private BigDecimal targetR;
    @Column(name = "planned_risk_per_trade_pct")
    private BigDecimal plannedRiskPerTradePct;
    @Column(name = "hard_max_risk_per_trade_pct")
    private BigDecimal hardMaxRiskPerTradePct;
    @Column(name = "planned_max_trades_per_day")
    private Integer plannedMaxTradesPerDay;
    @Column(name = "planned_max_trades_per_week")
    private Integer plannedMaxTradesPerWeek;
    @Column(name = "planned_minimum_rr")
    private BigDecimal plannedMinimumRr;
    @Column(name = "status", nullable = false, length = 24)
    private String status;
    @Enumerated(EnumType.STRING)
    @Column(name = "snapshot_source", nullable = false, length = 32)
    private SnapshotSource snapshotSource;
    @Column(name = "snapshot_locked_at")
    private OffsetDateTime snapshotLockedAt;
    @Column(name = "snapshot_adjustment_amount")
    private BigDecimal snapshotAdjustmentAmount;
    @Column(name = "snapshot_adjustment_note", columnDefinition = "TEXT")
    private String snapshotAdjustmentNote;
    @Column(name = "target_changed_at")
    private OffsetDateTime targetChangedAt;
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (targetType == null) targetType = GrowthTargetType.PERCENTAGE;
        if (targetBasis == null) targetBasis = "MONTH_START_BALANCE";
        if (status == null) status = "ACTIVE";
        if (snapshotSource == null) snapshotSource = SnapshotSource.RECONSTRUCTED;
        if (snapshotLockedAt == null) snapshotLockedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
