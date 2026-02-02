package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AttributionSummary {
    private List<BreakdownRow> symbols;
    private List<BreakdownRow> strategies;
    private List<BreakdownRow> setups;
    private List<BreakdownRow> catalysts;
    private List<BreakdownRow> bottomSymbols;
    private List<BreakdownRow> bottomTags;
    private ConcentrationSummary concentration;
}
