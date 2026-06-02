package com.tradevault.dto.maintenance;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class DatabaseResetResponse {
    String status;
    Map<String, Integer> deletedRows;
    List<String> preserved;
}
