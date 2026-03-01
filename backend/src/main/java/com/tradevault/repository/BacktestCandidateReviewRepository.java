package com.tradevault.repository;

import com.tradevault.domain.entity.BacktestCandidateReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BacktestCandidateReviewRepository extends JpaRepository<BacktestCandidateReview, UUID> {
    List<BacktestCandidateReview> findBySetup_IdAndUser_IdOrderByCreatedAtUtcDesc(UUID setupId, UUID userId);
}
