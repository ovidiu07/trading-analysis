package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.ContextSnapshotMode;
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
import org.hibernate.annotations.JdbcTypeCode;
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
@Table(name = "context_snapshots")
public class ContextSnapshot {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ContextSnapshotMode mode;

    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_version_id")
    private UUID strategyVersionId;

    @Column(name = "prereqs_template_id")
    private UUID prereqsTemplateId;

    @Column(name = "prereqs_template_version_id")
    private UUID prereqsTemplateVersionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prereqs_states_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode prereqsStatesJson;

    @Column(name = "triggers_template_id")
    private UUID triggersTemplateId;

    @Column(name = "triggers_template_version_id")
    private UUID triggersTemplateVersionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "triggers_states_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode triggersStatesJson;

    @Column(name = "selected_sweep_level_id")
    private UUID selectedSweepLevelId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "levels_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode levelsSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lock_in_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode lockInSnapshotJson;

    @Column(name = "rr_at_entry", precision = 18, scale = 8)
    private BigDecimal rrAtEntry;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "quality_score_inputs_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode qualityScoreInputsJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
