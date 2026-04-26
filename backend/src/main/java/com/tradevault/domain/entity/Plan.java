package com.tradevault.domain.entity;

import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "plans")
public class Plan {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private UUID id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "scope", columnDefinition = "planscope", nullable = false)
    private PlanScope scope;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "source", columnDefinition = "plansource", nullable = false)
    private PlanSource source;

    @Column(name = "author_user_id")
    private UUID authorUserId;

    @Column(name = "author_display_name")
    private String authorDisplayName;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "checklist_json", columnDefinition = "TEXT")
    private String checklistJson;

    @Column(name = "active_from", nullable = false)
    private OffsetDateTime activeFrom;

    @Column(name = "active_to", nullable = false)
    private OffsetDateTime activeTo;

    @Builder.Default
    @Column(name = "featured", nullable = false)
    private boolean featured = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "removed_at")
    private OffsetDateTime removedAt;

    @Column(name = "removed_by_user_id")
    private UUID removedByUserId;
}
