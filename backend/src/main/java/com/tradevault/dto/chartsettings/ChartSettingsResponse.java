package com.tradevault.dto.chartsettings;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ChartSettingsResponse {
    private List<String> preloadedIndicators;
}
