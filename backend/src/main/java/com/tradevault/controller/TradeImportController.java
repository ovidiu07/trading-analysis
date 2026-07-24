package com.tradevault.controller;

import com.tradevault.dto.tradeimport.Mt5ImportPreviewResponse;
import com.tradevault.service.Mt5TradeImportService;
import com.tradevault.service.TradeImportCoordinatorService;
import com.tradevault.service.Trading212TradeImportService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/trade-imports")
@RequiredArgsConstructor
public class TradeImportController {
    private final Mt5TradeImportService mt5TradeImportService;
    private final Trading212TradeImportService trading212TradeImportService;
    private final TradeImportCoordinatorService coordinatorService;

    @PostMapping(value = "/metatrader5/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mt5ImportPreviewResponse preview(@RequestPart("file") MultipartFile file,
                                            @RequestParam(required = false) UUID targetAccountId,
                                            @RequestParam(required = false) String sourceTimezone) throws IOException {
        return mt5TradeImportService.preview(file, targetAccountId, sourceTimezone);
    }

    @PostMapping(value = "/trading212/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Object previewTrading212(@RequestPart("file") MultipartFile file,
                                    @RequestParam(required = false) UUID targetAccountId) throws IOException {
        return trading212TradeImportService.preview(file, targetAccountId);
    }

    @PostMapping("/{importBatchId}/commit")
    public Object commit(@PathVariable UUID importBatchId, @RequestBody JsonNode request) {
        return coordinatorService.commit(importBatchId, request);
    }

    @GetMapping("/{importBatchId}")
    public Object details(@PathVariable UUID importBatchId) {
        return coordinatorService.details(importBatchId);
    }
}
