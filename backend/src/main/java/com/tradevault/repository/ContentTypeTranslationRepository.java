package com.tradevault.repository;

import com.tradevault.domain.entity.ContentTypeTranslation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ContentTypeTranslationRepository extends JpaRepository<ContentTypeTranslation, UUID> {
    List<ContentTypeTranslation> findByContentTypeIdInAndLocaleIn(Collection<UUID> contentTypeIds, Collection<String> locales);

    List<ContentTypeTranslation> findByContentTypeIdIn(Collection<UUID> contentTypeIds);
}
