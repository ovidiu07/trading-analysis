package com.tradevault.domain.entity;

import com.tradevault.domain.enums.AutoJournalState;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TodaySessionStatus;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "today_sessions")
public class TodaySession {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "profit_target", nullable = false)
    private BigDecimal profitTarget;

    @Column(name = "loss_limit", nullable = false)
    private BigDecimal lossLimit;

    @Column(name = "max_trades", nullable = false)
    private Integer maxTrades;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private TodaySessionStatus status;

    @Column(name = "planned_tickers", columnDefinition = "TEXT")
    private String plannedTickersJson;

    @Column(name = "checklist_state", columnDefinition = "TEXT")
    private String checklistStateJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checklist_template_id")
    private ChecklistTemplate checklistTemplate;

    @Column(name = "prereqs_state", columnDefinition = "TEXT")
    private String prereqsStateJson;

    @Column(name = "triggers_state", columnDefinition = "TEXT")
    private String triggersStateJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prereqs_template_id")
    private ChecklistTemplate prereqsTemplate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "triggers_template_id")
    private ChecklistTemplate triggersTemplate;

    @Column(name = "active_sweep_level_id")
    private UUID activeSweepLevelId;

    @Column(name = "active_entry_level_id")
    private UUID activeEntryLevelId;

    @Column(name = "active_sl_level_id")
    private UUID activeSlLevelId;

    @Column(name = "active_tp_level_id")
    private UUID activeTpLevelId;

    @Column(name = "active_sweep_pool_id")
    private UUID activeSweepPoolId;

    @Column(name = "lock_in_session", length = 24)
    private String lockInSession;

    @Column(name = "lock_in_objective", length = 32)
    private String lockInObjective;

    @Column(name = "lock_in_bias", length = 16)
    private String lockInBias;

    @Column(name = "lock_in_bias_reason", length = 140)
    private String lockInBiasReason;

    @Column(name = "lock_in_at")
    private OffsetDateTime lockInAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "auto_journal_state", nullable = false, length = 16)
    @Builder.Default
    private AutoJournalState autoJournalState = AutoJournalState.DISARMED;

    @Column(name = "auto_journal_symbol", length = 64)
    private String autoJournalSymbol;

    @Enumerated(EnumType.STRING)
    @Column(name = "auto_journal_side", length = 8)
    private Direction autoJournalSide;

    @Column(name = "auto_journal_entry_price", precision = 18, scale = 8)
    private BigDecimal autoJournalEntryPrice;

    @Column(name = "auto_journal_sl_price", precision = 18, scale = 8)
    private BigDecimal autoJournalSlPrice;

    @Column(name = "auto_journal_tp_price", precision = 18, scale = 8)
    private BigDecimal autoJournalTpPrice;

    @Column(name = "auto_journal_tolerance_pips", precision = 10, scale = 4)
    private BigDecimal autoJournalTolerancePips;

    @Column(name = "auto_journal_timeout_min")
    private Integer autoJournalTimeoutMin;

    @Column(name = "auto_journal_armed_at")
    private OffsetDateTime autoJournalArmedAt;

    @Column(name = "auto_journal_last_event_at")
    private OffsetDateTime autoJournalLastEventAt;

    @Column(name = "auto_journal_last_error", length = 280)
    private String autoJournalLastError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
