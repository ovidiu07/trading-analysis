package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
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
@Table(name = "backtest_datasets")
public class BacktestDataset {
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestCandleSource provider;

    @Column(name = "source_id", nullable = false, length = 128)
    private String sourceId;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(name = "symbol_canonical", nullable = false, length = 64)
    private String symbolCanonical;

    @Column(name = "symbol_display", nullable = false, length = 96)
    private String symbolDisplay;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestTimeframe timeframe;

    @Column(name = "data_from", nullable = false)
    private OffsetDateTime dataFrom;

    @Column(name = "data_to", nullable = false)
    private OffsetDateTime dataTo;

    @Column(name = "row_count", nullable = false)
    private Integer rowCount;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "min_time_utc")
    private OffsetDateTime minTimeUtc;

    @Column(name = "max_time_utc")
    private OffsetDateTime maxTimeUtc;

    @Column(name = "candle_count")
    private Integer candleCount;

    @Column(name = "parsed_ok")
    private Boolean parsedOk;

    @Column(name = "error_msg", columnDefinition = "TEXT")
    private String errorMsg;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode metadataJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
