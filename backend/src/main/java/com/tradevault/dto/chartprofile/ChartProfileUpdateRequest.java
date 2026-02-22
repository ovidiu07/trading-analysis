package com.tradevault.dto.chartprofile;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradevault.domain.enums.ChartProfileScope;
import lombok.Data;

@Data
public class ChartProfileUpdateRequest {
    private String name;
    private ChartProfileScope scope;
    private Boolean isDefault;
    private JsonNode embedConfigJson;
    private JsonNode tjaPrefsJson;
}
