package com.tradevault.dto.session;

import com.tradevault.domain.enums.SessionSetupStatus;
import lombok.Data;

@Data
public class SessionSetupStatusRequest {
    private SessionSetupStatus status;
}
