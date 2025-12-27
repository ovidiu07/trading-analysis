package com.tradevault.controller;

import com.tradevault.dto.trade.ImportResult;
import com.tradevault.service.ImportExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CsvController {
    private final ImportExportService importExportService;

    @PostMapping(value = "/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResult importCsv(@RequestPart("file") MultipartFile file) throws IOException {
        return importExportService.importCsv(file);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportCsv(@RequestParam(required = false) OffsetDateTime from,
                                            @RequestParam(required = false) OffsetDateTime to) throws IOException {
        String csv = importExportService.exportCsv(from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=trades.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv);
    }
}
