package com.tradevault.domain.entity;

import com.tradevault.domain.enums.AccountStatus;
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
    @Column(name = "account_type", length = 40)
    private String accountType;
    private String accountCurrency;
    private BigDecimal startingBalance;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private AccountStatus status = AccountStatus.ACTIVE;
    @Column(name = "is_default", nullable = false)
    private boolean isDefault;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    @Column(name = "demo_seed_id")
    private UUID demoSeedId;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        if (status == null) {
            status = AccountStatus.ACTIVE;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
