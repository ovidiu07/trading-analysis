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
@Table(name = "backtest_csv_mappings")
public class BacktestCsvMapping {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "header_signature", nullable = false, length = 256)
    private String headerSignature;

    @Column(name = "time_column", nullable = false, length = 128)
    private String timeColumn;

    @Column(name = "open_column", nullable = false, length = 128)
    private String openColumn;

    @Column(name = "high_column", nullable = false, length = 128)
    private String highColumn;

    @Column(name = "low_column", nullable = false, length = 128)
    private String lowColumn;

    @Column(name = "close_column", nullable = false, length = 128)
    private String closeColumn;

    @Column(name = "volume_column", length = 128)
    private String volumeColumn;

    @Column(name = "timezone", length = 64)
    private String timezone;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
