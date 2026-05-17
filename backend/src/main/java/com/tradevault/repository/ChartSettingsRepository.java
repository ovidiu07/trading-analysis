package com.tradevault.repository;

import com.tradevault.domain.entity.ChartSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChartSettingsRepository extends JpaRepository<ChartSettings, String> {
}
