package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.SignalEventType;
import com.tradevault.domain.enums.SignalHtfBias;
import com.tradevault.domain.enums.SignalRegime;
import com.tradevault.domain.enums.SignalSetupType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "signal_events")
public class SignalEvent {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "external_trade_id", nullable = false, length = 191)
    private String externalTradeId;

    @Column(nullable = false, length = 64)
    private String symbol;

    @Column(nullable = false, length = 16)
    private String timeframe;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    private SignalEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "setup_type", nullable = false, length = 48)
    private SignalSetupType setupType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Direction direction;

    @Column(name = "signal_timestamp", nullable = false)
    private OffsetDateTime signalTimestamp;

    @Column(name = "signal_bar_time", nullable = false)
    private OffsetDateTime signalBarTime;

    @Column(name = "entry_price", nullable = false, precision = 18, scale = 8)
    private BigDecimal entryPrice;

    @Column(name = "stop_loss", nullable = false, precision = 18, scale = 8)
    private BigDecimal stopLoss;

    @Column(name = "take_profit", precision = 18, scale = 8)
    private BigDecimal takeProfit;

    @Column(precision = 18, scale = 8)
    private BigDecimal rr;

    @Column(name = "confidence_score", nullable = false)
    private Integer confidenceScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private SignalRegime regime;

    @Enumerated(EnumType.STRING)
    @Column(name = "htf_bias", nullable = false, length = 16)
    private SignalHtfBias htfBias;

    @Column(name = "session_name", length = 64)
    private String sessionName;

    @Column(name = "parameter_profile_id", nullable = false, length = 64)
    private String parameterProfileId;

    @Column(name = "schema_version", nullable = false, length = 16)
    private String schemaVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode rawPayloadJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @OneToOne(mappedBy = "signalEvent", fetch = FetchType.LAZY)
    private SignalFeatureSnapshot featureSnapshot;

    @OneToOne(mappedBy = "signalEvent", fetch = FetchType.LAZY)
    private SignalOutcome outcome;
}
