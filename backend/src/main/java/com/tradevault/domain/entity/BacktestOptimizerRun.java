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
@Table(name = "backtest_optimizer_runs")
public class BacktestOptimizerRun {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dataset_set_id", nullable = false)
    private BacktestDatasetSet datasetSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_config_id")
    private BacktestStrategyConfig strategyConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "request_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode requestJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "results_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode resultsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "summary_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode summaryJson;

    @Column(name = "variant_count", nullable = false)
    private Integer variantCount;

    @Column(name = "max_variants", nullable = false)
    private Integer maxVariants;

    @Column(nullable = false, length = 24)
    private String status;

    @Column(name = "created_at_utc", nullable = false, updatable = false)
    private OffsetDateTime createdAtUtc;

    @PrePersist
    void prePersistDefaults() {
        if (requestJson == null) {
            requestJson = JsonNodeFactory.instance.objectNode();
        }
        if (resultsJson == null) {
            resultsJson = JsonNodeFactory.instance.arrayNode();
        }
        if (summaryJson == null) {
            summaryJson = JsonNodeFactory.instance.objectNode();
        }
        if (variantCount == null) {
            variantCount = 0;
        }
        if (maxVariants == null) {
            maxVariants = 100;
        }
        if (status == null || status.isBlank()) {
            status = "COMPLETED";
        }
        if (createdAtUtc == null) {
            createdAtUtc = OffsetDateTime.now(java.time.ZoneOffset.UTC);
        }
    }
}
