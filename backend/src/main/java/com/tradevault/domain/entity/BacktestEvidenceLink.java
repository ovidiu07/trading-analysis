package com.tradevault.domain.entity;

import com.tradevault.domain.enums.BacktestingClassificationStatus;
import com.tradevault.domain.enums.BacktestingEvidenceSource;
import com.tradevault.domain.enums.BacktestingSyncStatus;
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
import org.hibernate.annotations.UpdateTimestamp;

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
@Table(name = "backtest_evidence_links")
public class BacktestEvidenceLink {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id")
    private BacktestingWorkspace workspace;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "live_trade_id", nullable = false)
    private UUID liveTradeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 16)
    private BacktestingEvidenceSource sourceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_status", nullable = false, length = 32)
    private BacktestingSyncStatus syncStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification_status", nullable = false, length = 32)
    private BacktestingClassificationStatus classificationStatus;

    @Column(name = "included_in_analytics", nullable = false)
    private boolean includedInAnalytics;

    @Column(name = "excluded_reason", columnDefinition = "TEXT")
    private String excludedReason;

    @Column(name = "research_classification", columnDefinition = "TEXT")
    private String researchClassificationJson;

    @Column(name = "trade_date")
    private LocalDate tradeDate;

    @Column(name = "opened_at")
    private OffsetDateTime openedAt;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(length = 64)
    private String instrument;

    @Column(length = 16)
    private String direction;

    @Column(length = 40)
    private String session;

    @Column(length = 40)
    private String timeframe;

    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_name_snapshot", length = 255)
    private String strategyNameSnapshot;

    @Column(name = "setup_name", length = 255)
    private String setupName;

    @Column(name = "setup_grade", length = 32)
    private String setupGrade;

    @Column(length = 16)
    private String result;

    @Column(name = "realized_r", precision = 12, scale = 4)
    private BigDecimal realizedR;

    @Column(name = "net_pnl", precision = 20, scale = 8)
    private BigDecimal netPnl;

    @Column(name = "risk_percent", precision = 10, scale = 4)
    private BigDecimal riskPercent;

    @Column(name = "rule_break_count", nullable = false)
    private Integer ruleBreakCount;

    @Column(name = "screenshot_count", nullable = false)
    private Integer screenshotCount;

    @Column(name = "notes_snapshot", columnDefinition = "TEXT")
    private String notesSnapshot;

    @Column(name = "last_synced_at")
    private OffsetDateTime lastSyncedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void defaults() {
        if (sourceType == null) sourceType = BacktestingEvidenceSource.LIVE;
        if (syncStatus == null) syncStatus = BacktestingSyncStatus.PENDING;
        if (classificationStatus == null) classificationStatus = BacktestingClassificationStatus.NEEDS_CLASSIFICATION;
        if (ruleBreakCount == null) ruleBreakCount = 0;
        if (screenshotCount == null) screenshotCount = 0;
    }
}
