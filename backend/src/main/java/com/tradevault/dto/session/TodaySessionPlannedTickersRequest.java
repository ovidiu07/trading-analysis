package com.tradevault.dto.session;

import lombok.Data;

import java.util.List;

@Data
public class TodaySessionPlannedTickersRequest {
    private List<String> tickers;
}
