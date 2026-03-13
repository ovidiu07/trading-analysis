package com.tradevault.repository;

import com.tradevault.domain.entity.SignalOutcome;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SignalOutcomeRepository extends JpaRepository<SignalOutcome, UUID> {
    Optional<SignalOutcome> findBySignalEvent_Id(UUID signalEventId);
}
