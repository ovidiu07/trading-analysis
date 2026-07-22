package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.TradeSource;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "imported_trade_executions")
public class ImportedTradeExecution {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator") private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "trade_id") private Trade trade;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "import_batch_id") private TradeImportBatch importBatch;
    @Enumerated(EnumType.STRING) private TradeSource source;
    private String brokerServer;
    private String externalAccountId;
    private String externalDealId;
    private String externalOrderId;
    private String externalPositionId;
    private String symbol;
    private String executionDirection;
    private String entryExitClassification;
    private BigDecimal quantity;
    private BigDecimal price;
    private OffsetDateTime executedAt;
    private String originalBrokerTimestamp;
    private BigDecimal commission;
    private BigDecimal fee;
    private BigDecimal cost;
    private BigDecimal swap;
    private BigDecimal profit;
    private BigDecimal balanceAfter;
    private String currency;
    @Column(columnDefinition = "TEXT") private String comment;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false) private JsonNode rawSourceData;
    @PrePersist void defaults() { if (rawSourceData == null) rawSourceData = JsonNodeFactory.instance.objectNode(); }
}
