package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.TradeImportBatch;
import com.tradevault.dto.tradeimport.Mt5ImportCommitRequest;
import com.tradevault.dto.tradeimport.Trading212ImportCommitRequest;
import com.tradevault.repository.TradeImportBatchRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TradeImportCoordinatorService {
    private final CurrentUserService currentUserService;
    private final TradeImportBatchRepository batchRepository;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final Mt5TradeImportService mt5TradeImportService;
    private final Trading212TradeImportService trading212TradeImportService;

    public Object commit(UUID batchId, JsonNode requestPayload) {
        TradeImportBatch batch = ownedBatch(batchId);
        return switch (batch.getSource()) {
            case MT5_HTML -> mt5TradeImportService.commit(batchId,
                    validated(objectMapper.convertValue(requestPayload, Mt5ImportCommitRequest.class)));
            case TRADING212_CSV -> trading212TradeImportService.commit(batchId,
                    validated(objectMapper.convertValue(requestPayload, Trading212ImportCommitRequest.class)));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This import source does not support the preview/commit workflow");
        };
    }

    public Object details(UUID batchId) {
        TradeImportBatch batch = ownedBatch(batchId);
        return switch (batch.getSource()) {
            case MT5_HTML -> mt5TradeImportService.details(batchId);
            case TRADING212_CSV -> trading212TradeImportService.details(batchId);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This import source does not support batch details");
        };
    }

    private TradeImportBatch ownedBatch(UUID batchId) {
        UUID userId = currentUserService.getCurrentUser().getId();
        return batchRepository.findByIdAndUserId(batchId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Import batch not found"));
    }

    private <T> T validated(T value) {
        Set<ConstraintViolation<T>> violations = validator.validate(value);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }
}
