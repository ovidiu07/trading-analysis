package com.tradevault.domain.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "trade_import_rows",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_trade_import_rows_user_tx", columnNames = {"user_id", "transaction_id"})
        })
public class TradeImportRow {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "transaction_id", nullable = false)
    private String transactionId;

    @Column(name = "imported_at", nullable = false)
    private OffsetDateTime importedAt;
}
