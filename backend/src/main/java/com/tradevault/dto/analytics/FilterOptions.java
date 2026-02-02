package com.tradevault.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class FilterOptions {
    private List<String> symbols;
    private List<String> markets;
    private List<String> strategies;
    private List<String> setups;
    private List<String> catalysts;
}
