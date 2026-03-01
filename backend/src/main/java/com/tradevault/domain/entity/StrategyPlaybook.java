package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.StrategyPlaybookStatus;
import com.tradevault.domain.enums.StrategyTemplate;
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
@Table(name = "strategy_playbooks")
public class StrategyPlaybook {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_set_id")
    private BacktestDatasetSet datasetSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_config_id")
    private BacktestStrategyConfig strategyConfig;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id")
    private BacktestRun run;

    @Column(name = "name", nullable = false, length = 180)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "template_family", nullable = false, length = 64)
    private StrategyTemplate templateFamily;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private StrategyPlaybookStatus status;

    @Column(name = "expected_win_rate", precision = 8, scale = 4)
    private BigDecimal expectedWinRate;

    @Column(name = "expectancy_r", precision = 12, scale = 6)
    private BigDecimal expectancyR;

    @Column(name = "profit_factor", precision = 12, scale = 6)
    private BigDecimal profitFactor;

    @Column(name = "max_drawdown_r", precision = 12, scale = 6)
    private BigDecimal maxDrawdownR;

    @Column(name = "sample_size")
    private Integer sampleSize;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "playbook_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode playbookJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_summary_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode validationSummaryJson;

    @CreationTimestamp
    @Column(name = "created_at_utc", nullable = false, updatable = false)
    private OffsetDateTime createdAtUtc;

    @UpdateTimestamp
    @Column(name = "updated_at_utc", nullable = false)
    private OffsetDateTime updatedAtUtc;

    @PrePersist
    void prePersistDefaults() {
        if (templateFamily == null) {
            templateFamily = StrategyTemplate.CUSTOM;
        }
        if (status == null) {
            status = StrategyPlaybookStatus.ACTIVE;
        }
        if (playbookJson == null) {
            playbookJson = JsonNodeFactory.instance.objectNode();
        }
        if (validationSummaryJson == null) {
            validationSummaryJson = JsonNodeFactory.instance.objectNode();
        }
    }
}
