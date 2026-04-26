package com.tradevault.service;

import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.Plan;
import com.tradevault.domain.entity.PlanAsset;
import com.tradevault.domain.entity.TodaySession;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.domain.enums.PlanScope;
import com.tradevault.domain.enums.PlanSource;
import com.tradevault.domain.enums.TodaySessionStatus;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.asset.AssetUploadRequest;
import com.tradevault.repository.PlanAssetRepository;
import com.tradevault.repository.PlanRepository;
import com.tradevault.repository.TodaySessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PlanImageServiceTest {
    private CurrentUserService currentUserService;
    private TimezoneService timezoneService;
    private TodaySessionRepository todaySessionRepository;
    private PlanRepository planRepository;
    private PlanAssetRepository planAssetRepository;
    private AssetService assetService;
    private PlanImageService planImageService;

    private User user;
    private TodaySession todaySession;
    private Plan weeklyPlan;

    @BeforeEach
    void setup() {
        currentUserService = mock(CurrentUserService.class);
        timezoneService = mock(TimezoneService.class);
        todaySessionRepository = mock(TodaySessionRepository.class);
        planRepository = mock(PlanRepository.class);
        planAssetRepository = mock(PlanAssetRepository.class);
        assetService = mock(AssetService.class);

        planImageService = new PlanImageService(
                currentUserService,
                timezoneService,
                todaySessionRepository,
                planRepository,
                planAssetRepository,
                assetService
        );

        user = User.builder()
                .id(UUID.randomUUID())
                .email("plans@example.com")
                .timezone("Europe/Bucharest")
                .build();
        todaySession = TodaySession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .sessionDate(LocalDate.now(ZoneId.of("Europe/Bucharest")))
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(BigDecimal.ZERO)
                .maxTrades(1)
                .status(TodaySessionStatus.ACTIVE)
                .build();
        weeklyPlan = Plan.builder()
                .id(UUID.randomUUID())
                .scope(PlanScope.WEEKLY)
                .source(PlanSource.USER)
                .authorUserId(user.getId())
                .title("Weekly plan")
                .content("{}")
                .activeFrom(OffsetDateTime.now().minusDays(1))
                .activeTo(OffsetDateTime.now().plusDays(7))
                .build();

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(timezoneService.resolveZone(null, user)).thenReturn(ZoneId.of("Europe/Bucharest"));
        when(todaySessionRepository.findByUser_IdAndSessionDate(eq(user.getId()), any(LocalDate.class))).thenReturn(Optional.of(todaySession));
        when(planRepository.findUserActiveByWindow(eq(PlanSource.USER), eq(PlanScope.WEEKLY), eq(user.getId()), any(), any()))
                .thenReturn(List.of(weeklyPlan));
        when(planAssetRepository.countByTodaySession_Id(todaySession.getId())).thenReturn(0L);
        when(planAssetRepository.countByPlan_Id(weeklyPlan.getId())).thenReturn(2L);
    }

    @Test
    void uploadsMultipleImagesToWeeklyPlanWithStablePlanRelation() {
        MockMultipartFile first = new MockMultipartFile("files", "one.png", "image/png", "png".getBytes());
        MockMultipartFile second = new MockMultipartFile("files", "two.jpg", "image/jpeg", "jpg".getBytes());

        when(assetService.upload(any(), any())).thenAnswer(invocation -> {
            AssetUploadRequest request = invocation.getArgument(1, AssetUploadRequest.class);
            UUID assetId = UUID.randomUUID();
            Asset asset = Asset.builder()
                    .id(assetId)
                    .scope(AssetScope.PLAN)
                    .originalFileName("uploaded.png")
                    .contentType("image/png")
                    .sizeBytes(10L)
                    .s3Key("plan-images/key.png")
                    .build();
            PlanAsset relation = PlanAsset.builder()
                    .id(UUID.randomUUID())
                    .plan(weeklyPlan)
                    .user(user)
                    .planScope(request.getPlanScope())
                    .asset(asset)
                    .sortOrder(request.getSortOrder())
                    .build();
            when(planAssetRepository.findByAsset_IdAndUser_Id(assetId, user.getId())).thenReturn(Optional.of(relation));
            when(assetService.toAssetResponse(asset)).thenReturn(AssetResponse.builder()
                    .id(assetId)
                    .scope(AssetScope.PLAN)
                    .originalFileName(asset.getOriginalFileName())
                    .contentType(asset.getContentType())
                    .sizeBytes(asset.getSizeBytes())
                    .viewUrl("/api/assets/%s/view".formatted(assetId))
                    .thumbnailUrl("/api/assets/%s/view".formatted(assetId))
                    .image(true)
                    .metadata(java.util.Map.of())
                    .build());
            return AssetResponse.builder().id(assetId).scope(AssetScope.PLAN).build();
        });

        var response = planImageService.uploadImages(PlanScope.WEEKLY, List.of(first, second));

        assertThat(response).hasSize(2);
        ArgumentCaptor<AssetUploadRequest> requestCaptor = ArgumentCaptor.forClass(AssetUploadRequest.class);
        verify(assetService, org.mockito.Mockito.times(2)).upload(any(), requestCaptor.capture());
        assertThat(requestCaptor.getAllValues())
                .extracting(AssetUploadRequest::getScope)
                .containsOnly(AssetScope.PLAN);
        assertThat(requestCaptor.getAllValues())
                .extracting(AssetUploadRequest::getPlanScope)
                .containsOnly(PlanScope.WEEKLY);
        assertThat(requestCaptor.getAllValues())
                .extracting(AssetUploadRequest::getPlanId)
                .containsOnly(weeklyPlan.getId());
        assertThat(requestCaptor.getAllValues())
                .extracting(AssetUploadRequest::getSortOrder)
                .containsExactly(2, 3);
    }

    @Test
    void uploadsImageToTodayPlan() {
        MockMultipartFile image = new MockMultipartFile("files", "today.webp", "image/webp", "webp".getBytes());
        UUID assetId = UUID.randomUUID();
        Asset asset = Asset.builder()
                .id(assetId)
                .scope(AssetScope.PLAN)
                .originalFileName("today.webp")
                .contentType("image/webp")
                .sizeBytes(12L)
                .s3Key("plan-images/key.webp")
                .build();
        PlanAsset relation = PlanAsset.builder()
                .id(UUID.randomUUID())
                .todaySession(todaySession)
                .user(user)
                .planScope(PlanScope.DAILY)
                .asset(asset)
                .sortOrder(0)
                .build();
        when(assetService.upload(any(), any())).thenReturn(AssetResponse.builder().id(assetId).scope(AssetScope.PLAN).build());
        when(planAssetRepository.findByAsset_IdAndUser_Id(assetId, user.getId())).thenReturn(Optional.of(relation));
        when(assetService.toAssetResponse(asset)).thenReturn(AssetResponse.builder()
                .id(assetId)
                .scope(AssetScope.PLAN)
                .originalFileName("today.webp")
                .contentType("image/webp")
                .sizeBytes(12L)
                .viewUrl("/api/assets/%s/view".formatted(assetId))
                .thumbnailUrl("/api/assets/%s/view".formatted(assetId))
                .metadata(java.util.Map.of())
                .build());

        var response = planImageService.uploadImages(PlanScope.DAILY, List.of(image));

        assertThat(response).singleElement().satisfies(uploaded -> {
            assertThat(uploaded.getTodaySessionId()).isEqualTo(todaySession.getId());
            assertThat(uploaded.getPlanScope()).isEqualTo(PlanScope.DAILY);
            assertThat(uploaded.getViewUrl()).contains(assetId.toString());
        });
    }

    @Test
    void rejectsNonImageFilesWithoutCallingStorageUpload() {
        MockMultipartFile pdf = new MockMultipartFile("files", "plan.pdf", "application/pdf", "%PDF".getBytes());

        assertThatThrownBy(() -> planImageService.uploadImages(PlanScope.DAILY, List.of(pdf)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only image files");

        verifyNoInteractions(assetService);
    }

    @Test
    void deleteRejectsImageNotOwnedByCurrentUser() {
        UUID imageId = UUID.randomUUID();
        when(planAssetRepository.findByIdAndUser_Id(imageId, user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> planImageService.deleteImage(PlanScope.DAILY, imageId))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Plan image not found");
    }
}
