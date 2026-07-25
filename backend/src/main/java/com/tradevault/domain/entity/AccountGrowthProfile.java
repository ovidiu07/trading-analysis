package com.tradevault.domain.entity;

import com.tradevault.domain.enums.CapitalSource;
import com.tradevault.domain.enums.DrawdownType;
import com.tradevault.domain.enums.GrowthAccountType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "account_growth_profiles")
public class AccountGrowthProfile {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false, unique = true)
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 40)
    private GrowthAccountType accountType;
    @Column(name = "initial_capital")
    private BigDecimal initialCapital;
    @Enumerated(EnumType.STRING)
    @Column(name = "capital_source", nullable = false, length = 32)
    private CapitalSource capitalSource;
    @Column(name = "default_risk_per_trade_pct", nullable = false)
    private BigDecimal defaultRiskPerTradePct;
    @Column(name = "preferred_max_risk_per_trade_pct", nullable = false)
    private BigDecimal preferredMaxRiskPerTradePct;
    @Column(name = "max_concurrent_risk_pct", nullable = false)
    private BigDecimal maxConcurrentRiskPct;
    @Column(name = "max_daily_risk_pct")
    private BigDecimal maxDailyRiskPct;
    @Column(name = "max_daily_loss_amount")
    private BigDecimal maxDailyLossAmount;
    @Column(name = "max_total_drawdown_pct")
    private BigDecimal maxTotalDrawdownPct;
    @Column(name = "max_total_drawdown_amount")
    private BigDecimal maxTotalDrawdownAmount;
    @Enumerated(EnumType.STRING)
    @Column(name = "drawdown_type", nullable = false, length = 32)
    private DrawdownType drawdownType;
    @Column(name = "monthly_target_pct", nullable = false)
    private BigDecimal monthlyTargetPct;
    @Column(name = "compounds_monthly", nullable = false)
    private boolean compoundsMonthly;
    @Column(name = "profit_target_pct")
    private BigDecimal profitTargetPct;
    @Column(name = "profit_target_amount")
    private BigDecimal profitTargetAmount;
    @Column(name = "minimum_trading_days")
    private Integer minimumTradingDays;
    @Column(name = "challenge_deadline")
    private LocalDate challengeDeadline;
    @Column(name = "consistency_rule_type", length = 40)
    private String consistencyRuleType;
    @Column(name = "consistency_rule_value")
    private BigDecimal consistencyRuleValue;
    @Column(name = "trailing_drawdown_enabled", nullable = false)
    private boolean trailingDrawdownEnabled;
    @Column(name = "trailing_drawdown_type", length = 40)
    private String trailingDrawdownType;
    @Column(name = "trailing_drawdown_amount")
    private BigDecimal trailingDrawdownAmount;
    @Column(name = "trailing_drawdown_high_water_mark")
    private BigDecimal trailingDrawdownHighWaterMark;
    @Column(name = "contract_limit")
    private Integer contractLimit;
    @Column(name = "scaling_restrictions", columnDefinition = "TEXT")
    private String scalingRestrictions;
    @Column(name = "profit_split_pct")
    private BigDecimal profitSplitPct;
    @Column(name = "payout_threshold")
    private BigDecimal payoutThreshold;
    @Column(name = "payout_frequency", length = 80)
    private String payoutFrequency;
    @Column(name = "payout_eligibility_rules", columnDefinition = "TEXT")
    private String payoutEligibilityRules;
    @Column(name = "reset_details", columnDefinition = "TEXT")
    private String resetDetails;
    @Column(name = "active", nullable = false)
    private boolean active;
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (accountType == null) accountType = GrowthAccountType.OTHER;
        if (capitalSource == null) capitalSource = CapitalSource.ACCOUNT_DEFAULT;
        if (drawdownType == null) drawdownType = DrawdownType.NONE;
        if (defaultRiskPerTradePct == null) defaultRiskPerTradePct = new BigDecimal("0.5");
        if (preferredMaxRiskPerTradePct == null) preferredMaxRiskPerTradePct = BigDecimal.ONE;
        if (maxConcurrentRiskPct == null) maxConcurrentRiskPct = new BigDecimal("2.0");
        if (monthlyTargetPct == null) monthlyTargetPct = new BigDecimal("3.0");
        active = true;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
