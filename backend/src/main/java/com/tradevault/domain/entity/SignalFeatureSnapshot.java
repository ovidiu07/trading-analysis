package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
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
@Table(name = "signal_feature_snapshots")
public class SignalFeatureSnapshot {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "signal_event_id", nullable = false)
    private SignalEvent signalEvent;

    @Column(precision = 18, scale = 8)
    private BigDecimal atr;

    @Column(name = "atr_mean", precision = 18, scale = 8)
    private BigDecimal atrMean;

    @Column(precision = 18, scale = 8)
    private BigDecimal adx;

    @Column(name = "ema_slope", precision = 18, scale = 8)
    private BigDecimal emaSlope;

    @Column(name = "body_pct", precision = 18, scale = 8)
    private BigDecimal bodyPct;

    @Column(name = "sweep_depth_atr", precision = 18, scale = 8)
    private BigDecimal sweepDepthAtr;

    @Column(name = "fvg_size_atr", precision = 18, scale = 8)
    private BigDecimal fvgSizeAtr;

    @Column(name = "ob_size_atr", precision = 18, scale = 8)
    private BigDecimal obSizeAtr;

    @Column(name = "volatility_state", length = 32)
    private String volatilityState;

    @Column(name = "range_state", length = 32)
    private String rangeState;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "feature_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode featureJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
