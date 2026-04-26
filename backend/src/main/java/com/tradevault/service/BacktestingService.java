package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.config.UploadProperties;
import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.BacktestingScreenshot;
import com.tradevault.domain.entity.BacktestingWorkspace;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.domain.enums.BacktestingWorkspaceStatus;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.backtesting.BacktestingListResponse;
import com.tradevault.dto.backtesting.BacktestingScreenshotRequest;
import com.tradevault.dto.backtesting.BacktestingScreenshotResponse;
import com.tradevault.dto.backtesting.BacktestingStrategySummaryResponse;
import com.tradevault.dto.backtesting.BacktestingSummaryResponse;
import com.tradevault.dto.backtesting.BacktestingWorkspaceRequest;
import com.tradevault.dto.backtesting.BacktestingWorkspaceResponse;
import com.tradevault.repository.AssetRepository;
import com.tradevault.repository.BacktestingScreenshotRepository;
import com.tradevault.repository.BacktestingWorkspaceRepository;
import com.tradevault.repository.UserStrategyRepository;
import com.tradevault.service.storage.ObjectStorageService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLConnection;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BacktestingService {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final BacktestingWorkspaceRepository workspaceRepository;
    private final BacktestingScreenshotRepository screenshotRepository;
    private final UserStrategyRepository userStrategyRepository;
    private final AssetRepository assetRepository;
    private final CurrentUserService currentUserService;
    private final ObjectStorageService objectStorageService;
    private final AssetService assetService;
    private final ObjectMapper objectMapper;
    private final UploadProperties uploadProperties;

    @Transactional(readOnly = true)
    public BacktestingListResponse listActiveWorkspaces() {
        User user = currentUserService.getCurrentUser();
        List<BacktestingWorkspace> workspaces = workspaceRepository
                .findByUser_IdAndStatusOrderByUpdatedAtDesc(user.getId(), BacktestingWorkspaceStatus.ACTIVE);
        Map<UUID, Integer> screenshotCounts = screenshotCounts(workspaces);
        List<BacktestingWorkspaceResponse> responses = workspaces.stream()
                .map(workspace -> toWorkspaceResponse(workspace, screenshotCounts.getOrDefault(workspace.getId(), 0), false))
                .toList();
        return BacktestingListResponse.builder()
                .summary(buildSummary(responses))
                .workspaces(responses)
                .build();
    }

    @Transactional(readOnly = true)
    public BacktestingWorkspaceResponse getWorkspace(UUID id) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(id, user);
        return toWorkspaceResponse(workspace, (int) screenshotRepository.countByWorkspace_Id(workspace.getId()), true);
    }

    @Transactional
    public BacktestingWorkspaceResponse createWorkspace(BacktestingWorkspaceRequest request) {
        User user = currentUserService.getCurrentUser();
        UserStrategy strategy = resolveStrategy(request.getStrategyId(), user);
        BacktestingWorkspace workspace = BacktestingWorkspace.builder()
                .user(user)
                .symbol(requireText(request.getSymbol(), "symbol").toUpperCase(Locale.ROOT))
                .marketType(normalizeOptionalText(request.getMarketType()))
                .strategy(strategy)
                .strategyNameSnapshot(resolveStrategyNameSnapshot(request, strategy))
                .title(normalizeOptionalText(request.getTitle()))
                .primaryTimeframe(normalizeOptionalText(request.getPrimaryTimeframe()))
                .contextTimeframe(normalizeOptionalText(request.getContextTimeframe()))
                .executionTimeframe(normalizeOptionalText(request.getExecutionTimeframe()))
                .entryTimeframe(normalizeOptionalText(request.getEntryTimeframe()))
                .numberOfTrades(defaultInt(request.getNumberOfTrades()))
                .winningTrades(defaultInt(request.getWinningTrades()))
                .losingTrades(defaultInt(request.getLosingTrades()))
                .breakevenTrades(defaultInt(request.getBreakevenTrades()))
                .averageR(request.getAverageR())
                .notes(normalizeOptionalText(request.getNotes()))
                .whatWorked(normalizeOptionalText(request.getWhatWorked()))
                .whatFailed(normalizeOptionalText(request.getWhatFailed()))
                .bestConditions(normalizeOptionalText(request.getBestConditions()))
                .avoidConditions(normalizeOptionalText(request.getAvoidConditions()))
                .status(BacktestingWorkspaceStatus.ACTIVE)
                .build();
        validateStats(workspace);
        return toWorkspaceResponse(workspaceRepository.save(workspace), 0, true);
    }

    @Transactional
    public BacktestingWorkspaceResponse updateWorkspace(UUID id, BacktestingWorkspaceRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(id, user);
        UserStrategy strategy = resolveStrategy(request.getStrategyId(), user);
        workspace.setSymbol(requireText(request.getSymbol(), "symbol").toUpperCase(Locale.ROOT));
        workspace.setMarketType(normalizeOptionalText(request.getMarketType()));
        workspace.setStrategy(strategy);
        workspace.setStrategyNameSnapshot(resolveStrategyNameSnapshot(request, strategy));
        workspace.setTitle(normalizeOptionalText(request.getTitle()));
        workspace.setPrimaryTimeframe(normalizeOptionalText(request.getPrimaryTimeframe()));
        workspace.setContextTimeframe(normalizeOptionalText(request.getContextTimeframe()));
        workspace.setExecutionTimeframe(normalizeOptionalText(request.getExecutionTimeframe()));
        workspace.setEntryTimeframe(normalizeOptionalText(request.getEntryTimeframe()));
        workspace.setNumberOfTrades(defaultInt(request.getNumberOfTrades()));
        workspace.setWinningTrades(defaultInt(request.getWinningTrades()));
        workspace.setLosingTrades(defaultInt(request.getLosingTrades()));
        workspace.setBreakevenTrades(defaultInt(request.getBreakevenTrades()));
        workspace.setAverageR(request.getAverageR());
        workspace.setNotes(normalizeOptionalText(request.getNotes()));
        workspace.setWhatWorked(normalizeOptionalText(request.getWhatWorked()));
        workspace.setWhatFailed(normalizeOptionalText(request.getWhatFailed()));
        workspace.setBestConditions(normalizeOptionalText(request.getBestConditions()));
        workspace.setAvoidConditions(normalizeOptionalText(request.getAvoidConditions()));
        validateStats(workspace);
        BacktestingWorkspace saved = workspaceRepository.save(workspace);
        return toWorkspaceResponse(saved, (int) screenshotRepository.countByWorkspace_Id(saved.getId()), true);
    }

    @Transactional
    public void archiveWorkspace(UUID id) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(id, user);
        workspace.setStatus(BacktestingWorkspaceStatus.ARCHIVED);
        workspace.setUpdatedAt(OffsetDateTime.now());
        workspaceRepository.save(workspace);
    }

    @Transactional(readOnly = true)
    public List<BacktestingScreenshotResponse> listScreenshots(UUID workspaceId) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(workspaceId, user);
        return screenshotRepository.findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(workspace.getId(), user.getId())
                .stream()
                .map(this::toScreenshotResponse)
                .toList();
    }

    @Transactional
    public List<BacktestingScreenshotResponse> uploadScreenshots(UUID workspaceId, List<MultipartFile> files) {
        User user = currentUserService.getCurrentUser();
        BacktestingWorkspace workspace = requireOwnedWorkspace(workspaceId, user);
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("At least one screenshot is required");
        }
        int nextSort = screenshotRepository.findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(workspace.getId(), user.getId()).stream()
                .map(BacktestingScreenshot::getSortOrder)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(-1) + 1;
        List<BacktestingScreenshotResponse> responses = new ArrayList<>();
        for (MultipartFile file : files) {
            BacktestingScreenshot screenshot = uploadScreenshot(workspace, user, file, nextSort++);
            responses.add(toScreenshotResponse(screenshot));
        }
        workspace.setUpdatedAt(OffsetDateTime.now());
        workspaceRepository.save(workspace);
        return responses;
    }

    @Transactional
    public BacktestingScreenshotResponse updateScreenshot(UUID id, BacktestingScreenshotRequest request) {
        User user = currentUserService.getCurrentUser();
        BacktestingScreenshot screenshot = screenshotRepository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Screenshot not found"));
        screenshot.setCaption(normalizeOptionalText(request.getCaption()));
        screenshot.setTradeResult(request.getTradeResult());
        screenshot.setSession(normalizeOptionalText(request.getSession()));
        screenshot.setTimeframe(normalizeOptionalText(request.getTimeframe()));
        screenshot.setTagsJson(writeList(normalizeList(request.getTags())));
        screenshot.setSortOrder(request.getSortOrder());
        BacktestingScreenshot saved = screenshotRepository.save(screenshot);
        saved.getWorkspace().setUpdatedAt(OffsetDateTime.now());
        workspaceRepository.save(saved.getWorkspace());
        return toScreenshotResponse(saved);
    }

    @Transactional
    public void deleteScreenshot(UUID id) {
        User user = currentUserService.getCurrentUser();
        BacktestingScreenshot screenshot = screenshotRepository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Screenshot not found"));
        UUID assetId = screenshot.getAsset().getId();
        screenshot.getWorkspace().setUpdatedAt(OffsetDateTime.now());
        workspaceRepository.save(screenshot.getWorkspace());
        assetService.deleteAsset(assetId);
    }

    private BacktestingScreenshot uploadScreenshot(BacktestingWorkspace workspace, User user, MultipartFile file, int sortOrder) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read uploaded file");
        }
        String contentType = detectContentType(file, bytes);
        validateImageUpload(file.getSize(), contentType);
        String originalName = sanitizeFileName(file.getOriginalFilename());
        String s3Key = "backtesting/%s/%s/%s-%s".formatted(user.getId(), workspace.getId(), UUID.randomUUID(), originalName);
        objectStorageService.putObject(s3Key, bytes, contentType);
        try {
            Asset asset = assetRepository.save(Asset.builder()
                    .ownerUser(user)
                    .scope(AssetScope.BACKTESTING)
                    .originalFileName(originalName)
                    .contentType(contentType)
                    .sizeBytes(file.getSize())
                    .s3Key(s3Key)
                    .metadata(buildMetadataJson(contentType, bytes))
                    .build());
            return screenshotRepository.save(BacktestingScreenshot.builder()
                    .workspace(workspace)
                    .user(user)
                    .asset(asset)
                    .sortOrder(sortOrder)
                    .build());
        } catch (RuntimeException ex) {
            objectStorageService.deleteObject(s3Key);
            throw ex;
        }
    }

    private BacktestingWorkspace requireOwnedWorkspace(UUID id, User user) {
        return workspaceRepository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Backtesting workspace not found"));
    }

    private UserStrategy resolveStrategy(UUID strategyId, User user) {
        if (strategyId == null) {
            return null;
        }
        return userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Strategy not found"));
    }

    private Map<UUID, Integer> screenshotCounts(List<BacktestingWorkspace> workspaces) {
        List<UUID> ids = workspaces.stream().map(BacktestingWorkspace::getId).toList();
        if (ids.isEmpty()) return Map.of();
        return screenshotRepository.findByWorkspace_IdIn(ids).stream()
                .collect(Collectors.groupingBy(row -> row.getWorkspace().getId(), LinkedHashMap::new, Collectors.summingInt(row -> 1)));
    }

    private BacktestingSummaryResponse buildSummary(List<BacktestingWorkspaceResponse> workspaces) {
        int totalScreenshots = workspaces.stream().mapToInt(item -> item.getScreenshotCount() == null ? 0 : item.getScreenshotCount()).sum();
        int totalTrades = workspaces.stream().mapToInt(item -> item.getNumberOfTrades() == null ? 0 : item.getNumberOfTrades()).sum();
        BigDecimal averageWinRate = totalTrades == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(workspaces.stream().mapToInt(item -> item.getWinningTrades() == null ? 0 : item.getWinningTrades()).sum())
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalTrades), 1, RoundingMode.HALF_UP);
        String bestPerformer = workspaces.stream()
                .filter(item -> item.getNumberOfTrades() != null && item.getNumberOfTrades() > 0)
                .max(Comparator.comparing(BacktestingWorkspaceResponse::getWinRate))
                .map(item -> item.getSymbol() + " · " + (item.getStrategyName() == null ? "Manual strategy" : item.getStrategyName()))
                .orElse(null);
        return BacktestingSummaryResponse.builder()
                .totalBacktests(workspaces.size())
                .totalScreenshots(totalScreenshots)
                .totalTradesTested(totalTrades)
                .averageWinRate(averageWinRate)
                .bestPerformer(bestPerformer)
                .build();
    }

    private BacktestingWorkspaceResponse toWorkspaceResponse(BacktestingWorkspace item, int screenshotCount, boolean includeStrategy) {
        int trades = safeInt(item.getNumberOfTrades());
        int wins = safeInt(item.getWinningTrades());
        int losses = safeInt(item.getLosingTrades());
        int be = safeInt(item.getBreakevenTrades());
        int categorized = wins + losses + be;
        String strategyName = item.getStrategy() != null ? item.getStrategy().getName() : item.getStrategyNameSnapshot();
        return BacktestingWorkspaceResponse.builder()
                .id(item.getId())
                .symbol(item.getSymbol())
                .marketType(item.getMarketType())
                .strategyId(item.getStrategy() == null ? null : item.getStrategy().getId())
                .strategyNameSnapshot(item.getStrategyNameSnapshot())
                .strategyName(strategyName)
                .title(item.getTitle())
                .primaryTimeframe(item.getPrimaryTimeframe())
                .contextTimeframe(item.getContextTimeframe())
                .executionTimeframe(item.getExecutionTimeframe())
                .entryTimeframe(item.getEntryTimeframe())
                .numberOfTrades(trades)
                .winningTrades(wins)
                .losingTrades(losses)
                .breakevenTrades(be)
                .averageR(item.getAverageR())
                .winRate(rate(wins, trades))
                .lossRate(rate(losses, trades))
                .breakevenRate(rate(be, trades))
                .categorizedTrades(categorized)
                .missingClassificationCount(Math.max(0, trades - categorized))
                .screenshotCount(screenshotCount)
                .notes(item.getNotes())
                .whatWorked(item.getWhatWorked())
                .whatFailed(item.getWhatFailed())
                .bestConditions(item.getBestConditions())
                .avoidConditions(item.getAvoidConditions())
                .status(item.getStatus() == null ? null : item.getStatus().name())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .strategy(includeStrategy ? toStrategySummary(item.getStrategy()) : null)
                .build();
    }

    private BacktestingStrategySummaryResponse toStrategySummary(UserStrategy strategy) {
        if (strategy == null) return null;
        return BacktestingStrategySummaryResponse.builder()
                .id(strategy.getId())
                .name(strategy.getName())
                .model(strategy.getModel())
                .entryConditions(readList(strategy.getEntryConditionsJson()))
                .invalidationLogic(strategy.getInvalidationLogic())
                .tpFramework(strategy.getTpFramework())
                .noTradeRules(strategy.getNoTradeRules())
                .build();
    }

    private BacktestingScreenshotResponse toScreenshotResponse(BacktestingScreenshot screenshot) {
        AssetResponse asset = assetService.toAssetResponse(screenshot.getAsset());
        return BacktestingScreenshotResponse.builder()
                .id(screenshot.getId())
                .workspaceId(screenshot.getWorkspace().getId())
                .assetId(screenshot.getAsset().getId())
                .originalFileName(asset.getOriginalFileName())
                .contentType(asset.getContentType())
                .sizeBytes(asset.getSizeBytes())
                .url(asset.getUrl())
                .viewUrl(asset.getViewUrl())
                .downloadUrl(asset.getDownloadUrl())
                .thumbnailUrl(asset.getThumbnailUrl())
                .caption(screenshot.getCaption())
                .tradeResult(screenshot.getTradeResult())
                .session(screenshot.getSession())
                .timeframe(screenshot.getTimeframe())
                .tags(readList(screenshot.getTagsJson()))
                .sortOrder(screenshot.getSortOrder())
                .createdAt(screenshot.getCreatedAt())
                .updatedAt(screenshot.getUpdatedAt())
                .asset(asset)
                .build();
    }

    private void validateStats(BacktestingWorkspace workspace) {
        int trades = safeInt(workspace.getNumberOfTrades());
        int wins = safeInt(workspace.getWinningTrades());
        int losses = safeInt(workspace.getLosingTrades());
        int be = safeInt(workspace.getBreakevenTrades());
        if (trades < 0 || wins < 0 || losses < 0 || be < 0) {
            throw new IllegalArgumentException("Trade stats must be greater than or equal to zero");
        }
        if (wins + losses + be > trades) {
            throw new IllegalArgumentException("Wins, losses, and breakeven trades cannot exceed number of trades");
        }
    }

    private void validateImageUpload(long sizeBytes, String contentType) {
        if (sizeBytes <= 0) throw new IllegalArgumentException("Uploaded file is empty");
        if (sizeBytes > uploadProperties.getMaxFileSizeBytes()) throw new IllegalArgumentException("File is too large");
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("Only image files can be uploaded to backtesting");
        }
        List<String> allowed = uploadProperties.getAllowedMimeTypes().stream()
                .filter(Objects::nonNull)
                .map(value -> value.toLowerCase(Locale.ROOT).trim())
                .toList();
        if (!allowed.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("File type is not allowed");
        }
    }

    private String detectContentType(MultipartFile file, byte[] bytes) {
        String detected = null;
        try {
            detected = URLConnection.guessContentTypeFromStream(new ByteArrayInputStream(bytes));
        } catch (IOException ignored) {
        }
        if (!StringUtils.hasText(detected) && StringUtils.hasText(file.getContentType())) detected = file.getContentType();
        if (!StringUtils.hasText(detected)) detected = resolveMimeByExtension(file.getOriginalFilename());
        if (!StringUtils.hasText(detected)) detected = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        return detected.toLowerCase(Locale.ROOT);
    }

    private String resolveMimeByExtension(String fileName) {
        if (fileName == null) return null;
        String normalized = fileName.toLowerCase(Locale.ROOT);
        if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
        if (normalized.endsWith(".png")) return "image/png";
        if (normalized.endsWith(".webp")) return "image/webp";
        if (normalized.endsWith(".gif")) return "image/gif";
        return null;
    }

    private String buildMetadataJson(String contentType, byte[] bytes) {
        if (contentType == null || !contentType.startsWith("image/")) return null;
        try {
            var image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) return null;
            return objectMapper.writeValueAsString(Map.of("width", image.getWidth(), "height", image.getHeight()));
        } catch (Exception ex) {
            return null;
        }
    }

    private String sanitizeFileName(String original) {
        String base = StringUtils.cleanPath(original == null ? "screenshot" : original);
        base = base.replaceAll("[\\\\/]+", "_").replaceAll("[^a-zA-Z0-9._-]+", "-").replaceAll("-{2,}", "-");
        return base.isBlank() ? "screenshot" : base;
    }

    private BigDecimal rate(int part, int total) {
        if (total <= 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(part).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String resolveStrategyNameSnapshot(BacktestingWorkspaceRequest request, UserStrategy strategy) {
        String manual = normalizeOptionalText(request.getStrategyNameSnapshot());
        if (strategy != null) return manual != null ? manual : strategy.getName();
        return manual;
    }

    private String requireText(String value, String field) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) throw new IllegalArgumentException(field + " is required");
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<String> normalizeList(List<String> values) {
        if (values == null) return List.of();
        return values.stream().map(this::normalizeOptionalText).filter(Objects::nonNull).distinct().toList();
    }

    private String writeList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values == null ? List.of() : values);
        } catch (Exception ex) {
            return "[]";
        }
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception ex) {
            return List.of();
        }
    }
}
