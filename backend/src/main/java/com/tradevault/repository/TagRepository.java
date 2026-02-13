package com.tradevault.repository;

import com.tradevault.domain.entity.Tag;
import com.tradevault.domain.enums.TagType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TagRepository extends JpaRepository<Tag, UUID> {
    List<Tag> findByUserId(UUID userId);
    List<Tag> findByUserIdAndType(UUID userId, TagType type);
    List<Tag> findByIdInAndUserId(Collection<UUID> ids, UUID userId);
    Optional<Tag> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndDemoSeedIdIsNotNull(UUID userId);

    long deleteByUserIdAndDemoSeedIdIsNotNull(UUID userId);
}
