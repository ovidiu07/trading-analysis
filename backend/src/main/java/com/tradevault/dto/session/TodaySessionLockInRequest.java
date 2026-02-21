package com.tradevault.dto.session;

import lombok.Data;

@Data
public class TodaySessionLockInRequest {
    private String session;
    private String objective;
    private String bias;
    private String biasReason;
}
