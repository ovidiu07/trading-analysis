package com.tradevault.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "accounts")
public class Account {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    private String name;
    private String broker;
    @Column(name = "external_account_id", length = 128)
    private String externalAccountId;
    @Column(name = "broker_server", length = 160)
    private String brokerServer;
    @Column(name = "broker_timezone", length = 80)
    private String brokerTimezone;
    private String accountCurrency;
    private BigDecimal startingBalance;
    private OffsetDateTime createdAt;

    @Column(name = "demo_seed_id")
    private UUID demoSeedId;
}
