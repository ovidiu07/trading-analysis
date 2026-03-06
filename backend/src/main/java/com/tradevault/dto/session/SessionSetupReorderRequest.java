package com.tradevault.dto.session;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SessionSetupReorderRequest {
    private List<UUID> setupIds;
}
