package com.tradevault.dto.today;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CoachFocusResponse {
    boolean available;
    String severity;
    String leakTitle;
    String action;
    String rationale;
}
