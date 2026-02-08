package com.tradevault.repository;

import com.tradevault.domain.entity.ContentPostTranslation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ContentPostTranslationRepository extends JpaRepository<ContentPostTranslation, UUID> {
    List<ContentPostTranslation> findByContentPostIdInAndLocaleIn(Collection<UUID> contentPostIds, Collection<String> locales);

    List<ContentPostTranslation> findByContentPostIdIn(Collection<UUID> contentPostIds);
}
