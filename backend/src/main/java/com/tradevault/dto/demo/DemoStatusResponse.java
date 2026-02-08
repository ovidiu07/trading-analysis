package com.tradevault.dto.demo;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DemoStatusResponse {
    private boolean demoEnabled;
    private boolean hasDemoData;
}
