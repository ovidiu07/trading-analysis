package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.entity.UserStrategy;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.strategy.StrategyRequest;
import com.tradevault.repository.AssetRepository;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.StrategyAssetRepository;
import com.tradevault.repository.StrategyVersionRepository;
import com.tradevault.repository.UserStrategyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class StrategyServiceTest {

    private UserStrategyRepository userStrategyRepository;
    private StrategyAssetRepository strategyAssetRepository;
    private AssetRepository assetRepository;
    private AssetService assetService;
    private ContentPostService contentPostService;
    private ContentPostRepository contentPostRepository;
    private CurrentUserService currentUserService;
    private StrategyVersionRepository strategyVersionRepository;
    private StrategyService strategyService;

    private User currentUser;

    @BeforeEach
    void setup() {
        userStrategyRepository = Mockito.mock(UserStrategyRepository.class);
        strategyAssetRepository = Mockito.mock(StrategyAssetRepository.class);
        assetRepository = Mockito.mock(AssetRepository.class);
        assetService = Mockito.mock(AssetService.class);
        contentPostService = Mockito.mock(ContentPostService.class);
        contentPostRepository = Mockito.mock(ContentPostRepository.class);
        currentUserService = Mockito.mock(CurrentUserService.class);
        strategyVersionRepository = Mockito.mock(StrategyVersionRepository.class);

        currentUser = User.builder()
                .id(UUID.randomUUID())
                .email("trader@test.com")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(currentUser);

        strategyService = new StrategyService(
                userStrategyRepository,
                strategyAssetRepository,
                assetRepository,
                assetService,
                contentPostService,
                contentPostRepository,
                currentUserService,
                new ObjectMapper(),
                strategyVersionRepository
        );
    }

    @Test
    void createStrategySanitizesRichEntryConditionsAndBuildsPreviewList() {
        StrategyRequest request = new StrategyRequest();
        request.setName("London Sweep");
        request.setModel("Sweep + MSS");
        request.setEntryConditionsRich("<h3>Checklist</h3><script>alert(1)</script><ul><li>Sweep PDH</li><li>Displacement</li></ul>");
        request.setInvalidationLogic("Close below origin");
        request.setTpFramework("1R partial");
        request.setNoTradeRules("News");
        request.setSessionSuitability(List.of("London"));
        request.setTags(List.of("sweep"));

        when(userStrategyRepository.save(any(UserStrategy.class))).thenAnswer(invocation -> {
            UserStrategy entity = invocation.getArgument(0, UserStrategy.class);
            if (entity.getId() == null) {
                entity.setId(UUID.randomUUID());
            }
            if (entity.getUpdatedAt() == null) {
                entity.setUpdatedAt(OffsetDateTime.now());
            }
            return entity;
        });
        when(assetService.listByStrategy(any())).thenReturn(List.of());

        var response = strategyService.createMyStrategy(request);

        assertFalse(response.getEntryConditionsRich().contains("<script"));
        assertEquals(List.of("Sweep PDH", "Displacement"), response.getEntryConditions());
    }

    @Test
    void setSnapshotRejectsNonImageAssets() {
        UUID strategyId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        UserStrategy strategy = UserStrategy.builder()
                .id(strategyId)
                .user(currentUser)
                .name("Plan")
                .model("Model")
                .entryConditionsJson("[]")
                .entryConditionsRich("<p>Entry</p>")
                .invalidationLogic("Invalidation")
                .tpFramework("TP")
                .build();
        Asset asset = Asset.builder()
                .id(assetId)
                .scope(AssetScope.STRATEGY)
                .ownerUser(currentUser)
                .contentType("application/pdf")
                .build();

        when(userStrategyRepository.findByIdAndUser_Id(strategyId, currentUser.getId())).thenReturn(Optional.of(strategy));
        when(strategyAssetRepository.existsByStrategy_IdAndAsset_Id(strategyId, assetId)).thenReturn(true);
        when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));

        assertThrows(IllegalArgumentException.class, () -> strategyService.setSnapshotAsset(strategyId, assetId));
    }
}
