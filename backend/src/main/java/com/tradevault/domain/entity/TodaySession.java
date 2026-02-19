package com.tradevault.domain.entity;

import com.tradevault.domain.enums.TodaySessionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "today_sessions")
public class TodaySession {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "profit_target", nullable = false)
    private BigDecimal profitTarget;

    @Column(name = "loss_limit", nullable = false)
    private BigDecimal lossLimit;

    @Column(name = "max_trades", nullable = false)
    private Integer maxTrades;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private TodaySessionStatus status;

    @Column(name = "planned_tickers", columnDefinition = "TEXT")
    private String plannedTickersJson;

    @Column(name = "checklist_state", columnDefinition = "TEXT")
    private String checklistStateJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checklist_template_id")
    private ChecklistTemplate checklistTemplate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
