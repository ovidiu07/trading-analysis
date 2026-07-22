package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.domain.enums.TradeSource;
import com.tradevault.domain.enums.TradeImportStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "trades")
public class Trade {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 32)
    @Builder.Default
    private TradeSource source = TradeSource.MANUAL;

    @Column(name = "external_account_id", length = 128)
    private String externalAccountId;
    @Column(name = "external_position_id", length = 128)
    private String externalPositionId;
    @Column(name = "source_broker")
    private String sourceBroker;
    @Column(name = "source_broker_server", length = 160)
    private String sourceBrokerServer;
    @Column(name = "source_timezone", length = 80)
    private String sourceTimezone;
    @Column(name = "account_currency", length = 16)
    private String accountCurrency;
    @Column(name = "broker_reported_pnl_currency", length = 16)
    private String brokerReportedPnlCurrency;
    @Column(name = "broker_reported_gross_pnl")
    private BigDecimal brokerReportedGrossPnl;
    @Column(name = "broker_reported_net_pnl")
    private BigDecimal brokerReportedNetPnl;
    @Column(name = "calculated_gross_pnl")
    private BigDecimal calculatedGrossPnl;
    @Column(name = "calculated_net_pnl")
    private BigDecimal calculatedNetPnl;
    @Column(name = "pnl_reconciliation_difference")
    private BigDecimal pnlReconciliationDifference;
    @Column(name = "initial_stop_loss_price")
    private BigDecimal initialStopLossPrice;
    @Column(name = "initial_take_profit_price")
    private BigDecimal initialTakeProfitPrice;
    @Column(name = "final_stop_loss_price")
    private BigDecimal finalStopLossPrice;
    @Column(name = "final_take_profit_price")
    private BigDecimal finalTakeProfitPrice;
    @Column(name = "entry_order_type", length = 80)
    private String entryOrderType;
    @Column(name = "exit_reason", length = 80)
    private String exitReason;
    @Column(name = "requested_entry_price")
    private BigDecimal requestedEntryPrice;
    @Column(name = "requested_exit_price")
    private BigDecimal requestedExitPrice;
    @Column(name = "entry_slippage_points")
    private BigDecimal entrySlippagePoints;
    @Column(name = "exit_slippage_points")
    private BigDecimal exitSlippagePoints;
    private BigDecimal swap;
    @Column(name = "broker_fees")
    private BigDecimal brokerFees;
    @Column(name = "import_batch_id")
    private UUID importBatchId;
    @Enumerated(EnumType.STRING)
    @Column(name = "import_status", length = 32)
    private TradeImportStatus importStatus;
    @Column(name = "imported_at")
    private OffsetDateTime importedAt;
    @Column(name = "last_synchronized_at")
    private OffsetDateTime lastSynchronizedAt;

    @Column(name = "broker_account_id", length = 128)
    private String brokerAccountId;

    @Column(name = "symbol", nullable = false)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "market_type")
    private Market market;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "direction", columnDefinition = "direction_type")
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", columnDefinition = "status_type", nullable = false)
    private TradeStatus status;

    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    private String timeframe;
    private BigDecimal quantity;
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal stopLossPrice;
    private BigDecimal takeProfitPrice;
    private BigDecimal fees;
    @Column(name = "fees_profile_currency")
    private BigDecimal feesProfileCurrency;
    private BigDecimal commission;
    private BigDecimal slippage;
    @Column(name = "contract_multiplier", nullable = false)
    private BigDecimal contractMultiplier;
    private BigDecimal pnlGross;
    private BigDecimal pnlNet;
    @Column(name = "pnl_profile_currency")
    private BigDecimal pnlProfileCurrency;
    @Column(name = "trade_currency")
    private String tradeCurrency;
    @Column(name = "profile_currency")
    private String profileCurrency;
    @Column(name = "fx_rate_trade_to_profile")
    private BigDecimal fxRateTradeToProfile;
    @Column(name = "fx_rate_timestamp")
    private OffsetDateTime fxRateTimestamp;
    @Column(name = "fx_rate_source")
    private String fxRateSource;
    private BigDecimal pnlPercent;
    private BigDecimal riskAmount;
    private BigDecimal riskPercent;
    private BigDecimal rMultiple;
    private BigDecimal capitalUsed;
    private String setup;
    @Column(name = "strategy_tag")
    private String strategyTag;
    private String catalystTag;
    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_version_id")
    private UUID strategyVersionId;

    @Column(name = "context_snapshot_id")
    private UUID contextSnapshotId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "setup_grade", columnDefinition = "trade_grade")
    private TradeGrade setupGrade;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "session", columnDefinition = "trade_session")
    private TradeSession session;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "setup_id")
    private UUID setupId;

    @Column(name = "sweep_level_id")
    private UUID sweepLevelId;

    @Column(name = "sweep_pool_id")
    private UUID sweepPoolId;

    @Column(name = "entry_level_id")
    private UUID entryLevelId;

    @Column(name = "sl_level_id")
    private UUID slLevelId;

    @Column(name = "tp_level_id")
    private UUID tpLevelId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "narrative_snapshot_json", columnDefinition = "jsonb", nullable = false)
    private JsonNode narrativeSnapshotJson;

    @Column(name = "sweep_confirmed")
    private Boolean sweepConfirmed;

    @Column(name = "displacement_confirmed")
    private Boolean displacementConfirmed;

    @Column(name = "mss_confirmed")
    private Boolean mssConfirmed;

    @Column(name = "sweep_depth_points")
    private BigDecimal sweepDepthPoints;

    @Column(name = "displacement_size_points")
    private BigDecimal displacementSizePoints;

    @Column(name = "time_sweep_to_entry_seconds")
    private Integer timeSweepToEntrySeconds;

    @Column(name = "mfe_points")
    private BigDecimal mfePoints;

    @Column(name = "mae_points")
    private BigDecimal maePoints;

    @Column(name = "level_expectation_met")
    private Boolean levelExpectationMet;

    @Column(name = "level_expectation", length = 48)
    private String levelExpectation;

    @Column(name = "feeling", length = 120)
    private String feeling;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "initial_notes", columnDefinition = "TEXT")
    private String initialNotes;

    @Column(name = "entry_journal_text", columnDefinition = "TEXT")
    private String entryJournalText;

    @Column(name = "entry_invalidation", columnDefinition = "TEXT")
    private String entryInvalidation;

    @Column(updatable = false)
    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    @Column(name = "demo_seed_id")
    private UUID demoSeedId;

    @Builder.Default
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "trade_content_links", joinColumns = @JoinColumn(name = "trade_id"))
    @Column(name = "content_id")
    private Set<UUID> linkedContentIds = new LinkedHashSet<>();

    @Builder.Default
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "trade_plans", joinColumns = @JoinColumn(name = "trade_id"))
    @Column(name = "plan_id")
    private Set<UUID> linkedPlanIds = new LinkedHashSet<>();

    @Builder.Default
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "trade_rule_breaks", joinColumns = @JoinColumn(name = "trade_id"))
    @Column(name = "rule_break")
    private Set<String> ruleBreaks = new LinkedHashSet<>();

    @Builder.Default
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "trade_entry_screenshot_assets", joinColumns = @JoinColumn(name = "trade_id"))
    @Column(name = "asset_id")
    private Set<UUID> entryScreenshotAssetIds = new LinkedHashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "trade_tags",
            joinColumns = @JoinColumn(name = "trade_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();

    @PrePersist
    @PreUpdate
    void ensureNarrativeSnapshotJson() {
        if (narrativeSnapshotJson == null || narrativeSnapshotJson.isNull()) {
            narrativeSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (contractMultiplier == null) {
            contractMultiplier = BigDecimal.ONE;
        }
        if (source == null) {
            source = TradeSource.MANUAL;
        }
    }
}
