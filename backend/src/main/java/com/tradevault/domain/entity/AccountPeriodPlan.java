package com.tradevault.domain.entity;

import com.tradevault.domain.enums.GrowthTargetType;
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
@Table(name = "account_period_plans", uniqueConstraints = @UniqueConstraint(
        name = "ux_account_period_plan", columnNames = {"account_id", "period_type", "period_key"}))
public class AccountPeriodPlan {
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
    @Column(name = "period_type", nullable = false, length = 16)
    private String periodType;
    @Column(name = "period_key", nullable = false, length = 16)
    private String periodKey;
    @Column(nullable = false, length = 80)
    private String timezone;
    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 40)
    private GrowthTargetType targetType;
    @Column(name = "target_value", nullable = false)
    private BigDecimal targetValue;
    @Column(name = "target_amount")
    private BigDecimal targetAmount;
    @Column(name = "max_loss_type", nullable = false, length = 40)
    private String maxLossType;
    @Column(name = "max_loss_value")
    private BigDecimal maxLossValue;
    @Column(name = "max_loss_amount")
    private BigDecimal maxLossAmount;
    @Column(name = "max_trades")
    private Integer maxTrades;
    @Column(name = "max_risk_budget")
    private BigDecimal maxRiskBudget;
    @Column(name = "max_consecutive_losses")
    private Integer maxConsecutiveLosses;
    @Column(name = "max_losing_days")
    private Integer maxLosingDays;
    @Column(name = "default_risk_per_trade")
    private BigDecimal defaultRiskPerTrade;
    @Column(name = "minimum_rr")
    private BigDecimal minimumRr;
    @Column(name = "stop_after_target", nullable = false)
    private boolean stopAfterTarget;
    @Column(name = "reduce_risk_after_target", nullable = false)
    private boolean reduceRiskAfterTarget;
    @Column(name = "risk_reduction_pct")
    private BigDecimal riskReductionPct;
    @Column(name = "stop_after_max_loss", nullable = false)
    private boolean stopAfterMaxLoss;
    @Column(name = "stop_after_consecutive_losses", nullable = false)
    private boolean stopAfterConsecutiveLosses;
    @Column(name = "permitted_sessions", length = 240)
    private String permittedSessions;
    @Column(length = 240)
    private String focus;
    @Column(columnDefinition = "TEXT")
    private String notes;
    @Column(name = "allocation_mode", nullable = false, length = 24)
    private String allocationMode;
    @Column(nullable = false)
    private boolean active;
    @Column(nullable = false)
    private int version;
    @Column(name = "effective_from", nullable = false)
    private OffsetDateTime effectiveFrom;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (effectiveFrom == null) effectiveFrom = now;
        if (targetType == null) targetType = GrowthTargetType.FIXED_AMOUNT;
        if (targetValue == null) targetValue = BigDecimal.ZERO;
        if (maxLossType == null) maxLossType = "FIXED_AMOUNT";
        if (allocationMode == null) allocationMode = "MANUAL";
        if (version < 1) version = 1;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}

