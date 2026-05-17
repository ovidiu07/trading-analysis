package com.tradevault.dto.chartsettings;

import lombok.Data;

import java.util.List;

@Data
public class ChartSettingsRequest {
    private List<String> preloadedIndicators;
}
