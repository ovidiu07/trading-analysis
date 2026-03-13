package com.tradevault.repository;

import com.tradevault.domain.entity.SignalProfileRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SignalProfileRecommendationRepository extends JpaRepository<SignalProfileRecommendation, UUID> {
    List<SignalProfileRecommendation> findByUser_IdAndActiveTrueOrderByRecommendationScoreDescGeneratedAtDesc(UUID userId);

    List<SignalProfileRecommendation> findByUser_IdOrderByGeneratedAtDesc(UUID userId);

    void deleteByUser_Id(UUID userId);
}
