package com.tradevault.controller;

import com.tradevault.dto.tradeimport.Mt5ImportCommitRequest;
import com.tradevault.dto.tradeimport.Mt5ImportCommitResponse;
import com.tradevault.dto.tradeimport.Mt5ImportPreviewResponse;
import com.tradevault.service.Mt5TradeImportService;
import jakarta.validation.Valid;
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

    @PostMapping(value = "/metatrader5/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mt5ImportPreviewResponse preview(@RequestPart("file") MultipartFile file,
                                            @RequestParam(required = false) UUID targetAccountId,
                                            @RequestParam(required = false) String sourceTimezone) throws IOException {
        return mt5TradeImportService.preview(file, targetAccountId, sourceTimezone);
    }

    @PostMapping("/{importBatchId}/commit")
    public Mt5ImportCommitResponse commit(@PathVariable UUID importBatchId, @Valid @RequestBody Mt5ImportCommitRequest request) {
        return mt5TradeImportService.commit(importBatchId, request);
    }

    @GetMapping("/{importBatchId}")
    public Object details(@PathVariable UUID importBatchId) {
        return mt5TradeImportService.details(importBatchId);
    }
}
