package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.SessionSetupReadinessState;
import com.tradevault.domain.enums.SessionSetupStatus;
import com.tradevault.domain.enums.TradeSession;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "session_setups")
public class SessionSetup {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private TodaySession todaySession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "symbol", nullable = false, length = 64)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "direction", nullable = false, columnDefinition = "direction_type")
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "market", columnDefinition = "market_type")
    private Market market;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "trade_session", columnDefinition = "trade_session")
    private TradeSession tradeSession;

    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_label", length = 120)
    private String strategyLabel;

    @Column(name = "setup_title", nullable = false, length = 140)
    private String setupTitle;

    @Column(name = "bias_alignment", length = 24)
    private String biasAlignment;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "narrative_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode narrativeSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode contextSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode triggerSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "execution_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode executionSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "strategy_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode strategySnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "review_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode reviewSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "levels_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode levelsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "mentor_reference_json", columnDefinition = "jsonb")
    private JsonNode mentorReferenceJson;

    @Column(name = "readiness_score", nullable = false)
    @Builder.Default
    private Integer readinessScore = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "readiness_state", nullable = false, length = 24)
    @Builder.Default
    private SessionSetupReadinessState readinessState = SessionSetupReadinessState.INCOMPLETE;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    @Builder.Default
    private SessionSetupStatus status = SessionSetupStatus.DRAFT;

    @Column(name = "linked_trade_id")
    private UUID linkedTradeId;

    @Column(name = "executed_at")
    private OffsetDateTime executedAt;

    @Column(name = "invalidated_at")
    private OffsetDateTime invalidatedAt;

    @Column(name = "skipped_at")
    private OffsetDateTime skippedAt;

    @Column(name = "archived_at")
    private OffsetDateTime archivedAt;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    private void applyDefaults() {
        if (narrativeSnapshotJson == null) {
            narrativeSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (contextSnapshotJson == null) {
            contextSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (triggerSnapshotJson == null) {
            triggerSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (executionSnapshotJson == null) {
            executionSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (strategySnapshotJson == null) {
            strategySnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (reviewSnapshotJson == null) {
            reviewSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (levelsJson == null) {
            levelsJson = JsonNodeFactory.instance.arrayNode();
        }
        if (mentorReferenceJson == null) {
            mentorReferenceJson = JsonNodeFactory.instance.objectNode();
        }
        if (readinessScore == null) {
            readinessScore = 0;
        }
        if (readinessState == null) {
            readinessState = SessionSetupReadinessState.INCOMPLETE;
        }
        if (status == null) {
            status = SessionSetupStatus.DRAFT;
        }
        if (sortOrder == null) {
            sortOrder = 0;
        }
    }
}
