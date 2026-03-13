package com.tradevault.repository;

import com.tradevault.domain.entity.SignalFeatureSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SignalFeatureSnapshotRepository extends JpaRepository<SignalFeatureSnapshot, UUID> {
    Optional<SignalFeatureSnapshot> findBySignalEvent_Id(UUID signalEventId);
}
