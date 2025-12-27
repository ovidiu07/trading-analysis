package com.tradevault.domain.entity;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "trades")
public class Trade {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    private String symbol;

    @Enumerated(EnumType.STRING)
    private Market market;

    @Enumerated(EnumType.STRING)
    private Direction direction;

    @Enumerated(EnumType.STRING)
    private TradeStatus status;

    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    private String timeframe;
    private BigDecimal quantity;
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal stopLossPrice;
    private BigDecimal takeProfitPrice;
    private BigDecimal fees;
    private BigDecimal commission;
    private BigDecimal slippage;
    private BigDecimal pnlGross;
    private BigDecimal pnlNet;
    private BigDecimal pnlPercent;
    private BigDecimal riskAmount;
    private BigDecimal riskPercent;
    private BigDecimal rMultiple;
    private BigDecimal capitalUsed;
    private String setup;
    private String strategyTag;
    private String catalystTag;

    @Column(columnDefinition = "TEXT")
    private String notes;

    private OffsetDateTime createdAt;

    @UpdateTimestamp
    private OffsetDateTime updatedAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "trade_tags",
            joinColumns = @JoinColumn(name = "trade_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();
}
