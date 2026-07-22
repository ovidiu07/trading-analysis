package com.tradevault.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.tradevault.domain.enums.TradeImportStatus;
import com.tradevault.domain.enums.TradeSource;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "trade_import_batches")
public class TradeImportBatch {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id")
    private User user;
    @Enumerated(EnumType.STRING) private TradeSource source;
    private String originalFilename;
    private String fileHash;
    private long fileSize;
    private String parserVersion;
    private String externalAccountId;
    private String accountName;
    private String accountCurrency;
    private String broker;
    private String brokerServer;
    private String accountType;
    private String accountingMode;
    private String reportGeneratedAtOriginal;
    private String sourceTimezone;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "target_account_id")
    private Account targetAccount;
    @Enumerated(EnumType.STRING) private TradeImportStatus status;
    private int positionsFound;
    private int ordersFound;
    private int dealsFound;
    private int tradesReady;
    private int createdTrades;
    private int updatedTrades;
    private int duplicates;
    private int warningCount;
    private int errorCount;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode parsedPayload;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode resultPayload;
    private OffsetDateTime createdAt;
    private OffsetDateTime completedAt;

    @PrePersist
    void defaults() {
        if (parsedPayload == null) parsedPayload = JsonNodeFactory.instance.objectNode();
        if (resultPayload == null) resultPayload = JsonNodeFactory.instance.objectNode();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
