package com.tradevault.dto.session;

import lombok.Data;

import java.util.UUID;

@Data
public class TodaySessionActiveSweepLevelRequest {
    private UUID levelId;
}
