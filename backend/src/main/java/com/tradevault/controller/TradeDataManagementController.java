package com.tradevault.controller;

import com.tradevault.dto.trade.TradeDataDeletionPreviewResponse;
import com.tradevault.dto.trade.TradeDataDeletionRequest;
import com.tradevault.dto.trade.TradeDataDeletionResponse;
import com.tradevault.service.TradeDataManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trade-data")
@RequiredArgsConstructor
public class TradeDataManagementController {
    private final TradeDataManagementService service;

    @PostMapping("/deletion-preview")
    public TradeDataDeletionPreviewResponse preview(@Valid @RequestBody TradeDataDeletionRequest request) {
        return service.preview(request);
    }

    @PostMapping("/delete")
    public TradeDataDeletionResponse delete(@Valid @RequestBody TradeDataDeletionRequest request) {
        return service.delete(request);
    }
}
