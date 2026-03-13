package com.tradevault.repository;

import com.tradevault.domain.entity.SignalPerformanceAggregate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SignalPerformanceAggregateRepository extends JpaRepository<SignalPerformanceAggregate, UUID> {
    List<SignalPerformanceAggregate> findByUser_IdOrderByUpdatedAtDesc(UUID userId);

    void deleteByUser_Id(UUID userId);
}
