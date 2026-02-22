package com.tradevault.domain.entity;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.domain.enums.BacktestTimeframe;
import com.tradevault.domain.enums.CandleChunkFormat;
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
@Table(name = "candle_chunks")
public class CandleChunk {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestCandleSource provider;

    @Column(name = "source_id", nullable = false, length = 128)
    private String sourceId;

    @Column(name = "symbol_canonical", nullable = false, length = 64)
    private String symbolCanonical;

    @Column(name = "symbol_display", nullable = false, length = 96)
    private String symbolDisplay;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BacktestTimeframe timeframe;

    @Column(name = "chunk_start_utc", nullable = false)
    private OffsetDateTime chunkStartUtc;

    @Column(name = "chunk_end_utc", nullable = false)
    private OffsetDateTime chunkEndUtc;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CandleChunkFormat format;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "payload", columnDefinition = "BYTEA")
    private byte[] payload;

    @Column(name = "object_key", length = 512)
    private String objectKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
