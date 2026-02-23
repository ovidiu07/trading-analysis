package com.tradevault.domain.entity;

import com.tradevault.domain.enums.LevelStatus;
import com.tradevault.domain.enums.LevelTimeframe;
import com.tradevault.domain.enums.LevelType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
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

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "liquidity_pools")
public class LiquidityPool {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "today_session_id", nullable = false)
    private TodaySession todaySession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "symbol", nullable = false, length = 64)
    private String symbol;

    @Column(name = "pool_name", nullable = false, length = 120)
    private String poolName;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    @Builder.Default
    private LevelType type = LevelType.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(name = "timeframe", nullable = false, length = 8)
    @Builder.Default
    private LevelTimeframe timeframe = LevelTimeframe.M15;

    @Column(name = "zone_low", precision = 18, scale = 8, nullable = false)
    private BigDecimal zoneLow;

    @Column(name = "zone_high", precision = 18, scale = 8, nullable = false)
    private BigDecimal zoneHigh;

    @Column(name = "cleanliness_score", nullable = false)
    @Builder.Default
    private Short cleanlinessScore = 3;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private LevelStatus status = LevelStatus.FRESH;

    @Column(name = "is_sweep_role", nullable = false)
    @Builder.Default
    private boolean sweepRole = false;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "pool_levels",
            joinColumns = @JoinColumn(name = "pool_id"),
            inverseJoinColumns = @JoinColumn(name = "level_id")
    )
    @Builder.Default
    private Set<SessionLevel> levels = new LinkedHashSet<>();

    @CreationTimestamp
    @Column(name = "created_at_utc", nullable = false, updatable = false)
    private OffsetDateTime createdAtUtc;

    @UpdateTimestamp
    @Column(name = "updated_at_utc", nullable = false)
    private OffsetDateTime updatedAtUtc;
}
