package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "backtest_run_reports")
public class BacktestRunReport {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id", nullable = false)
    private BacktestRun run;

    @Column(name = "strategy_id")
    private UUID strategyId;

    @Column(name = "strategy_name_snapshot", nullable = false, length = 180)
    private String strategyNameSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "strategy_config_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode strategyConfigSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "filters_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode filtersSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "summary_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode summarySnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trades_timeline_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode tradesTimelineSnapshotJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recommendations_snapshot_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode recommendationsSnapshotJson;

    @Column(name = "report_markdown", nullable = false, columnDefinition = "TEXT")
    private String reportMarkdown;

    @Column(name = "report_version", nullable = false, length = 32)
    private String reportVersion;

    @CreationTimestamp
    @Column(name = "created_at_utc", nullable = false, updatable = false)
    private OffsetDateTime createdAtUtc;

    @PrePersist
    void prePersistDefaults() {
        if (strategyConfigSnapshotJson == null) {
            strategyConfigSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (filtersSnapshotJson == null) {
            filtersSnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (summarySnapshotJson == null) {
            summarySnapshotJson = JsonNodeFactory.instance.objectNode();
        }
        if (tradesTimelineSnapshotJson == null) {
            tradesTimelineSnapshotJson = JsonNodeFactory.instance.arrayNode();
        }
        if (recommendationsSnapshotJson == null) {
            recommendationsSnapshotJson = JsonNodeFactory.instance.arrayNode();
        }
    }
}
