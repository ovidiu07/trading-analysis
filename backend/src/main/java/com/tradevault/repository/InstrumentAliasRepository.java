package com.tradevault.repository;

import com.tradevault.domain.entity.InstrumentAlias;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InstrumentAliasRepository extends JpaRepository<InstrumentAlias, UUID> {
    @Query("""
        SELECT a FROM InstrumentAlias a
        WHERE a.active = true
          AND (a.user.id = :userId OR a.user IS NULL)
          AND LOWER(a.externalSymbol) = LOWER(:symbol)
          AND (a.broker IS NULL OR LOWER(a.broker) = LOWER(:broker))
          AND (a.brokerServer IS NULL OR LOWER(a.brokerServer) = LOWER(:server))
        ORDER BY CASE WHEN a.user IS NULL THEN 1 ELSE 0 END
        """)
    List<InstrumentAlias> findMappings(@Param("userId") UUID userId, @Param("broker") String broker,
                                       @Param("server") String server, @Param("symbol") String symbol);

    @Query("""
        SELECT a FROM InstrumentAlias a
        WHERE a.user.id = :userId
          AND LOWER(a.externalSymbol) = LOWER(:symbol)
          AND COALESCE(LOWER(a.broker), '') = COALESCE(LOWER(:broker), '')
          AND COALESCE(LOWER(a.brokerServer), '') = COALESCE(LOWER(:server), '')
        """)
    Optional<InstrumentAlias> findOwned(@Param("userId") UUID userId, @Param("broker") String broker,
                                        @Param("server") String server, @Param("symbol") String symbol);
}
