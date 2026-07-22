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
@Entity @Table(name = "imported_trade_orders")
public class ImportedTradeOrder {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator") private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "trade_id") private Trade trade;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "import_batch_id") private TradeImportBatch importBatch;
    @Enumerated(EnumType.STRING) private TradeSource source;
    private String brokerServer;
    private String externalAccountId;
    private String externalOrderId;
    private String externalPositionId;
    private String symbol;
    private String orderType;
    private BigDecimal requestedQuantity;
    private BigDecimal filledQuantity;
    private BigDecimal requestedPrice;
    private BigDecimal stopLoss;
    private BigDecimal takeProfit;
    private String state;
    private OffsetDateTime openedAt;
    private OffsetDateTime completedAt;
    private String originalOpenedAt;
    private String originalCompletedAt;
    @Column(columnDefinition = "TEXT") private String comment;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false) private JsonNode rawSourceData;
    @PrePersist void defaults() { if (rawSourceData == null) rawSourceData = JsonNodeFactory.instance.objectNode(); }
}
