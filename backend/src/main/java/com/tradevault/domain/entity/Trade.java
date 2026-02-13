package com.tradevault.domain.entity;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeGrade;
import com.tradevault.domain.enums.TradeSession;
import com.tradevault.domain.enums.TradeStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.type.SqlTypes;

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

    @Column(name = "symbol", nullable = false)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "market_type")
    private Market market;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "direction", columnDefinition = "direction_type")
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", columnDefinition = "status_type", nullable = false)
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
    @Column(name = "strategy_tag")
    private String strategyTag;
    private String catalystTag;
    @Column(name = "strategy_id")
    private UUID strategyId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "setup_grade", columnDefinition = "trade_grade")
    private TradeGrade setupGrade;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "session", columnDefinition = "trade_session")
    private TradeSession session;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(updatable = false)
    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    @Column(name = "demo_seed_id")
    private UUID demoSeedId;

    @Builder.Default
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "trade_content_links", joinColumns = @JoinColumn(name = "trade_id"))
    @Column(name = "content_id")
    private Set<UUID> linkedContentIds = new LinkedHashSet<>();

    @Builder.Default
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "trade_rule_breaks", joinColumns = @JoinColumn(name = "trade_id"))
    @Column(name = "rule_break")
    private Set<String> ruleBreaks = new LinkedHashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "trade_tags",
            joinColumns = @JoinColumn(name = "trade_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();
}
