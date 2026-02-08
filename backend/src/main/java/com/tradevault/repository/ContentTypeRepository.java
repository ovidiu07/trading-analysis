package com.tradevault.repository;

import com.tradevault.domain.entity.ContentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContentTypeRepository extends JpaRepository<ContentType, UUID> {
    Optional<ContentType> findByKey(String key);

    boolean existsByKey(String key);

    List<ContentType> findByActiveTrueOrderBySortOrderAscKeyAsc();

    List<ContentType> findByOrderBySortOrderAscKeyAsc();

    List<ContentType> findByIdIn(Collection<UUID> ids);
}
