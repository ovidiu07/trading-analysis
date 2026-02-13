package com.tradevault.repository;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.enums.ContentPostStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ContentPostRepositoryCustom {

  Page<ContentPost> searchAdmin(UUID contentTypeId,
      ContentPostStatus status,
      String query,
      String locale,
      String fallbackLocale,
      Pageable pageable);

  List<ContentPost> searchPublished(ContentPostStatus status,
      String contentTypeKey,
      String query,
      String locale,
      String fallbackLocale,
      boolean activeOnly,
      OffsetDateTime now);
}
