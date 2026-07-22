package com.tradevault.domain.entity;

import com.tradevault.domain.enums.Market;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "instrument_aliases")
public class InstrumentAlias {
    @Id @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") private User user;
    private String broker;
    private String brokerServer;
    private String externalSymbol;
    private String internalSymbol;
    @Enumerated(EnumType.STRING) private Market market;
    private String tradeCurrency;
    private BigDecimal tickSize;
    private BigDecimal tickValue;
    private BigDecimal pointValue;
    private BigDecimal contractMultiplier;
    private boolean active;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    @PrePersist void create() { if (createdAt == null) createdAt = OffsetDateTime.now(); updatedAt = createdAt; active = true; }
    @PreUpdate void update() { updatedAt = OffsetDateTime.now(); }
}
