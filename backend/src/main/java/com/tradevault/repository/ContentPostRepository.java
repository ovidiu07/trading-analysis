package com.tradevault.repository;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.enums.ContentPostStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContentPostRepository extends JpaRepository<ContentPost, UUID>,
    ContentPostRepositoryCustom {
    Optional<ContentPost> findBySlug(String slug);
}
