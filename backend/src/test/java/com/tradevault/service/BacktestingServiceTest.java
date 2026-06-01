package com.tradevault.service;

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
import com.tradevault.dto.backtesting.BacktestingWorkspaceRequest;
import com.tradevault.repository.AssetRepository;
import com.tradevault.repository.BacktestingEdgeLensRepository;
import com.tradevault.repository.BacktestingScreenshotRepository;
import com.tradevault.repository.BacktestingTradeRepository;
import com.tradevault.repository.BacktestingWorkspaceRepository;
import com.tradevault.repository.UserStrategyRepository;
import com.tradevault.service.storage.ObjectStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BacktestingServiceTest {
    private BacktestingWorkspaceRepository workspaceRepository;
    private BacktestingScreenshotRepository screenshotRepository;
    private BacktestingTradeRepository tradeRepository;
    private BacktestingEdgeLensRepository edgeLensRepository;
    private UserStrategyRepository userStrategyRepository;
    private AssetRepository assetRepository;
    private CurrentUserService currentUserService;
    private ObjectStorageService objectStorageService;
    private AssetService assetService;
    private BacktestingService backtestingService;
    private User user;

    @BeforeEach
    void setup() {
        workspaceRepository = Mockito.mock(BacktestingWorkspaceRepository.class);
        screenshotRepository = Mockito.mock(BacktestingScreenshotRepository.class);
        tradeRepository = Mockito.mock(BacktestingTradeRepository.class);
        edgeLensRepository = Mockito.mock(BacktestingEdgeLensRepository.class);
        userStrategyRepository = Mockito.mock(UserStrategyRepository.class);
        assetRepository = Mockito.mock(AssetRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        objectStorageService = Mockito.mock(ObjectStorageService.class);
        assetService = Mockito.mock(AssetService.class);
        UploadProperties uploadProperties = new UploadProperties();
        uploadProperties.setMaxFileSizeMb(1);
        uploadProperties.setAllowedMimeTypes(List.of("image/png", "image/jpeg"));

        user = User.builder().id(UUID.randomUUID()).email("trader@test.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);

        backtestingService = new BacktestingService(
                workspaceRepository,
                screenshotRepository,
                tradeRepository,
                edgeLensRepository,
                userStrategyRepository,
                assetRepository,
                currentUserService,
                objectStorageService,
                assetService,
                new ObjectMapper(),
                uploadProperties,
                new BacktestingResearchService(null, null, null, null, null, null)
        );
    }

    @Test
    void createsWorkspaceWithManualStrategyName() {
        BacktestingWorkspaceRequest request = new BacktestingWorkspaceRequest();
        request.setSymbol("nq");
        request.setStrategyNameSnapshot("Liquidity Sweep + FVG");
        request.setNumberOfTrades(20);
        request.setWinningTrades(12);
        request.setLosingTrades(6);
        request.setBreakevenTrades(2);

        when(workspaceRepository.save(any())).thenAnswer(invocation -> {
            BacktestingWorkspace workspace = invocation.getArgument(0, BacktestingWorkspace.class);
            workspace.setId(UUID.randomUUID());
            workspace.setCreatedAt(OffsetDateTime.now());
            workspace.setUpdatedAt(OffsetDateTime.now());
            return workspace;
        });

        var response = backtestingService.createWorkspace(request);

        assertEquals("NQ", response.getSymbol());
        assertEquals("Liquidity Sweep + FVG", response.getStrategyNameSnapshot());
        assertEquals(0, response.getWinRate().compareTo(new java.math.BigDecimal("60.0")));
    }

    @Test
    void rejectsInvalidStats() {
        BacktestingWorkspaceRequest request = new BacktestingWorkspaceRequest();
        request.setSymbol("ES");
        request.setNumberOfTrades(5);
        request.setWinningTrades(4);
        request.setLosingTrades(2);
        request.setBreakevenTrades(0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> backtestingService.createWorkspace(request));
        assertEquals("Wins, losses, and breakeven trades cannot exceed number of trades", ex.getMessage());
    }

    @Test
    void createsWorkspaceWithLinkedStrategy() {
        UUID strategyId = UUID.randomUUID();
        UserStrategy strategy = UserStrategy.builder()
                .id(strategyId)
                .user(user)
                .name("NY Sweep")
                .model("Sweep + MSS")
                .entryConditionsJson("[]")
                .entryConditionsRich("<p></p>")
                .invalidationLogic("Origin invalidation")
                .tpFramework("2R")
                .build();
        BacktestingWorkspaceRequest request = new BacktestingWorkspaceRequest();
        request.setSymbol("ES");
        request.setStrategyId(strategyId);
        when(userStrategyRepository.findByIdAndUser_Id(strategyId, user.getId())).thenReturn(Optional.of(strategy));
        when(workspaceRepository.save(any())).thenAnswer(invocation -> {
            BacktestingWorkspace workspace = invocation.getArgument(0, BacktestingWorkspace.class);
            workspace.setId(UUID.randomUUID());
            workspace.setCreatedAt(OffsetDateTime.now());
            workspace.setUpdatedAt(OffsetDateTime.now());
            return workspace;
        });

        var response = backtestingService.createWorkspace(request);

        assertEquals(strategyId, response.getStrategyId());
        assertEquals("NY Sweep", response.getStrategyName());
    }

    @Test
    void uploadsMultipleScreenshotsWithBacktestingStorageKey() {
        BacktestingWorkspace workspace = BacktestingWorkspace.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("NQ")
                .status(BacktestingWorkspaceStatus.ACTIVE)
                .numberOfTrades(0)
                .winningTrades(0)
                .losingTrades(0)
                .breakevenTrades(0)
                .build();
        when(workspaceRepository.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        when(screenshotRepository.findByWorkspace_IdAndUser_IdOrderBySortOrderAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(List.of());
        when(assetRepository.save(any())).thenAnswer(invocation -> {
            Asset asset = invocation.getArgument(0, Asset.class);
            asset.setId(UUID.randomUUID());
            asset.setCreatedAt(OffsetDateTime.now());
            return asset;
        });
        when(screenshotRepository.save(any())).thenAnswer(invocation -> {
            BacktestingScreenshot screenshot = invocation.getArgument(0, BacktestingScreenshot.class);
            screenshot.setId(UUID.randomUUID());
            screenshot.setCreatedAt(OffsetDateTime.now());
            screenshot.setUpdatedAt(OffsetDateTime.now());
            return screenshot;
        });
        when(assetService.toAssetResponse(any())).thenAnswer(invocation -> {
            Asset asset = invocation.getArgument(0, Asset.class);
            return AssetResponse.builder()
                    .id(asset.getId())
                    .scope(AssetScope.BACKTESTING)
                    .originalFileName(asset.getOriginalFileName())
                    .contentType(asset.getContentType())
                    .sizeBytes(asset.getSizeBytes())
                    .viewUrl("/api/assets/" + asset.getId() + "/view")
                    .url("/api/assets/" + asset.getId() + "/view")
                    .build();
        });

        MockMultipartFile first = new MockMultipartFile("files", "one.png", "image/png", "png".getBytes());
        MockMultipartFile second = new MockMultipartFile("files", "two.png", "image/png", "png".getBytes());
        var response = backtestingService.uploadScreenshots(workspace.getId(), List.of(first, second));

        assertEquals(2, response.size());
        verify(objectStorageService, Mockito.times(2)).putObject(Mockito.startsWith("backtesting/" + user.getId() + "/" + workspace.getId()), any(), anyString());
    }

    @Test
    void rejectsNonImageScreenshotBeforeStorage() {
        BacktestingWorkspace workspace = BacktestingWorkspace.builder()
                .id(UUID.randomUUID())
                .user(user)
                .symbol("NQ")
                .build();
        when(workspaceRepository.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        MockMultipartFile pdf = new MockMultipartFile("files", "brief.pdf", "application/pdf", "%PDF".getBytes());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> backtestingService.uploadScreenshots(workspace.getId(), List.of(pdf)));

        assertEquals("Only image files can be uploaded to backtesting", ex.getMessage());
        verifyNoInteractions(objectStorageService);
    }
}
