package com.tradevault.repository;

import com.tradevault.domain.entity.SessionAutoTradeEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionAutoTradeEventRepository extends JpaRepository<SessionAutoTradeEvent, UUID> {
    List<SessionAutoTradeEvent> findByTodaySession_IdAndUser_IdOrderByCreatedAtUtcDesc(UUID sessionId, UUID userId);
}
