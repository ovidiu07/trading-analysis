package com.tradevault.repository;

import com.tradevault.domain.entity.SignalEvent;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SignalEventRepository extends JpaRepository<SignalEvent, UUID> {
    Optional<SignalEvent> findByUser_IdAndExternalTradeId(UUID userId, String externalTradeId);

    boolean existsByUser_IdAndExternalTradeId(UUID userId, String externalTradeId);

    @EntityGraph(attributePaths = {"featureSnapshot", "outcome"})
    List<SignalEvent> findByUser_IdOrderBySignalTimestampAsc(UUID userId);

    @EntityGraph(attributePaths = {"featureSnapshot", "outcome"})
    List<SignalEvent> findByUser_IdAndSignalTimestampBetweenOrderBySignalTimestampAsc(UUID userId,
                                                                                      OffsetDateTime from,
                                                                                      OffsetDateTime to);
}
