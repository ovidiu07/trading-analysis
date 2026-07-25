package com.tradevault.domain.entity;

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
@Table(name = "monthly_growth_plan_revisions")
public class MonthlyGrowthPlanRevision {
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
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private MonthlyGrowthPlan plan;
    private String previousTargetType;
    private BigDecimal previousTargetPct;
    private BigDecimal previousTargetAmount;
    private BigDecimal previousTargetR;
    private String newTargetType;
    private BigDecimal newTargetPct;
    private BigDecimal newTargetAmount;
    private BigDecimal newTargetR;
    private String reason;
    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    @PrePersist
    void onCreate() {
        if (changedAt == null) changedAt = OffsetDateTime.now();
    }
}
