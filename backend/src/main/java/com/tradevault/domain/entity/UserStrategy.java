package com.tradevault.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_strategies")
public class UserStrategy {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 255)
    private String model;

    @Column(name = "entry_conditions", nullable = false, columnDefinition = "TEXT")
    private String entryConditionsJson;

    @Column(name = "entry_conditions_rich", nullable = false, columnDefinition = "TEXT")
    private String entryConditionsRich;

    @Column(name = "invalidation_logic", nullable = false, columnDefinition = "TEXT")
    private String invalidationLogic;

    @Column(name = "tp_framework", nullable = false, columnDefinition = "TEXT")
    private String tpFramework;

    @Column(name = "no_trade_rules", columnDefinition = "TEXT")
    private String noTradeRules;

    @Column(name = "session_suitability", columnDefinition = "TEXT")
    private String sessionSuitabilityJson;

    @Column(name = "tags", columnDefinition = "TEXT")
    private String tagsJson;

    @Column(name = "snapshot_asset_id")
    private UUID snapshotAssetId;

    @Builder.Default
    @Column(name = "archived", nullable = false)
    private boolean archived = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
