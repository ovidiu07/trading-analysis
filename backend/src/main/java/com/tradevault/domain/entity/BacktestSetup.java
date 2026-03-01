package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.BacktestCandidateState;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
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
@Table(name = "backtest_setups")
public class BacktestSetup {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private BacktestRun run;

    @Column(name = "session_name", length = 64)
    private String sessionName;

    @Column(length = 16)
    private String direction;

    @Column(name = "sweep_type", length = 64)
    private String sweepType;

    @Column(name = "confirm_type", length = 32)
    private String confirmType;

    @Column(name = "sweep_time_utc")
    private OffsetDateTime sweepTimeUtc;

    @Column(name = "displacement_time_utc")
    private OffsetDateTime displacementTimeUtc;

    @Column(name = "confirm_time_utc")
    private OffsetDateTime confirmTimeUtc;

    @Column(name = "template_key", length = 64)
    private String templateKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "candidate_state", nullable = false, length = 32)
    private BacktestCandidateState candidateState;

    @Column(name = "quality_score", precision = 8, scale = 4)
    private BigDecimal qualityScore;

    @Column(name = "quality_label", length = 32)
    private String qualityLabel;

    @Column(name = "story_summary", columnDefinition = "TEXT")
    private String storySummary;

    @Column(name = "converted_trade_id")
    private UUID convertedTradeId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode evidenceJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersistDefaults() {
        if (evidenceJson == null) {
            evidenceJson = JsonNodeFactory.instance.objectNode();
        }
        if (candidateState == null) {
            candidateState = BacktestCandidateState.DETECTED;
        }
    }
}
