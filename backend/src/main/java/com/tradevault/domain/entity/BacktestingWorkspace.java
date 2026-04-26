package com.tradevault.domain.entity;

import com.tradevault.domain.enums.BacktestingWorkspaceStatus;
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
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "backtesting_workspaces")
public class BacktestingWorkspace {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 40)
    private String symbol;

    @Column(name = "market_type", length = 40)
    private String marketType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id")
    private UserStrategy strategy;

    @Column(name = "strategy_name_snapshot", length = 180)
    private String strategyNameSnapshot;

    @Column(length = 180)
    private String title;

    @Column(name = "primary_timeframe", length = 40)
    private String primaryTimeframe;

    @Column(name = "context_timeframe", length = 40)
    private String contextTimeframe;

    @Column(name = "execution_timeframe", length = 40)
    private String executionTimeframe;

    @Column(name = "entry_timeframe", length = 40)
    private String entryTimeframe;

    @Column(name = "number_of_trades", nullable = false)
    private Integer numberOfTrades;

    @Column(name = "winning_trades", nullable = false)
    private Integer winningTrades;

    @Column(name = "losing_trades", nullable = false)
    private Integer losingTrades;

    @Column(name = "breakeven_trades", nullable = false)
    private Integer breakevenTrades;

    @Column(name = "average_r", precision = 12, scale = 4)
    private BigDecimal averageR;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "what_worked", columnDefinition = "TEXT")
    private String whatWorked;

    @Column(name = "what_failed", columnDefinition = "TEXT")
    private String whatFailed;

    @Column(name = "best_conditions", columnDefinition = "TEXT")
    private String bestConditions;

    @Column(name = "avoid_conditions", columnDefinition = "TEXT")
    private String avoidConditions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestingWorkspaceStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersistDefaults() {
        if (numberOfTrades == null) numberOfTrades = 0;
        if (winningTrades == null) winningTrades = 0;
        if (losingTrades == null) losingTrades = 0;
        if (breakevenTrades == null) breakevenTrades = 0;
        if (status == null) status = BacktestingWorkspaceStatus.ACTIVE;
    }
}
