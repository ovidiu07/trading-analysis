package com.tradevault.dto.session;

import com.tradevault.domain.enums.SessionLevelCategory;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SessionLevelRequest {
    private String label;
    private BigDecimal price;
    private SessionLevelCategory category;
    private String notes;
    private Boolean swept;
}
