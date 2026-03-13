package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.SignalOutcomeStatus;
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
@Table(name = "signal_outcomes")
public class SignalOutcome {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "signal_event_id", nullable = false)
    private SignalEvent signalEvent;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome_status", nullable = false, length = 24)
    private SignalOutcomeStatus outcomeStatus;

    @Column(name = "close_timestamp", nullable = false)
    private OffsetDateTime closeTimestamp;

    @Column(name = "pnl_r", precision = 18, scale = 8)
    private BigDecimal pnlR;

    @Column(name = "pnl_amount", precision = 18, scale = 8)
    private BigDecimal pnlAmount;

    @Column(name = "hold_bars")
    private Integer holdBars;

    @Column(name = "hold_minutes")
    private Integer holdMinutes;

    @Column(name = "exit_reason", length = 32)
    private String exitReason;

    @Column(precision = 18, scale = 8)
    private BigDecimal slippage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_trade_id")
    private Trade linkedTrade;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode rawPayloadJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
