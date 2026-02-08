package com.tradevault.dto.demo;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DemoRemovalResponse {
    private boolean demoEnabled;
    private DemoRemovalCount removedCount;
}
