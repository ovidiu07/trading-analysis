package com.tradevault.dto.trade;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ImportResult {
    private int imported;
    private int failed;
}
