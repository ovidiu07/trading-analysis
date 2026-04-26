package com.tradevault.service;

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
import com.tradevault.dto.plan.PlanImageResponse;
import com.tradevault.repository.PlanAssetRepository;
import com.tradevault.repository.PlanRepository;
import com.tradevault.repository.TodaySessionRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlanImageService {
    private final CurrentUserService currentUserService;
    private final TimezoneService timezoneService;
    private final TodaySessionRepository todaySessionRepository;
    private final PlanRepository planRepository;
    private final PlanAssetRepository planAssetRepository;
    private final AssetService assetService;

    @Transactional(readOnly = true)
    public List<PlanImageResponse> listImages(PlanScope scope) {
        User user = currentUserService.getCurrentUser();
        PlanImageTarget target = resolveTarget(user, scope, false);
        if (target.todaySession() != null) {
            return planAssetRepository.findByTodaySession_IdOrderBySortOrderAscCreatedAtAsc(target.todaySession().getId())
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }
        if (target.plan() != null) {
            return planAssetRepository.findByPlan_IdOrderBySortOrderAscCreatedAtAsc(target.plan().getId())
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }
        return List.of();
    }

    @Transactional
    public List<PlanImageResponse> uploadImages(PlanScope scope, List<MultipartFile> files) {
        User user = currentUserService.getCurrentUser();
        List<MultipartFile> images = normalizeFiles(files);
        if (images.isEmpty()) {
            throw new IllegalArgumentException("At least one image file is required");
        }
        images.forEach(this::validateImageCandidate);

        PlanImageTarget target = resolveTarget(user, scope, true);
        long baseSortOrder = target.todaySession() != null
                ? planAssetRepository.countByTodaySession_Id(target.todaySession().getId())
                : planAssetRepository.countByPlan_Id(target.plan().getId());

        List<PlanImageResponse> uploaded = new ArrayList<>();
        for (int index = 0; index < images.size(); index++) {
            MultipartFile file = images.get(index);
            AssetUploadRequest request = new AssetUploadRequest();
            request.setScope(AssetScope.PLAN);
            request.setPlanScope(scope);
            request.setPlanId(target.plan() == null ? null : target.plan().getId());
            request.setTodaySessionId(target.todaySession() == null ? null : target.todaySession().getId());
            request.setSortOrder((int) baseSortOrder + index);

            AssetResponse asset = assetService.upload(file, request);
            PlanAsset relation = planAssetRepository.findByAsset_IdAndUser_Id(asset.getId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Plan image not found"));
            uploaded.add(toResponse(relation));
        }
        return uploaded;
    }

    @Transactional
    public void deleteImage(PlanScope scope, UUID imageId) {
        User user = currentUserService.getCurrentUser();
        PlanAsset relation = planAssetRepository.findByIdAndUser_Id(imageId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Plan image not found"));
        if (relation.getPlanScope() != scope) {
            throw new EntityNotFoundException("Plan image not found");
        }
        assetService.deleteAsset(relation.getAsset().getId());
    }

    public PlanImageResponse toResponse(PlanAsset relation) {
        AssetResponse asset = assetService.toAssetResponse(relation.getAsset());
        return PlanImageResponse.builder()
                .id(relation.getId())
                .assetId(asset.getId())
                .planId(relation.getPlan() == null ? null : relation.getPlan().getId())
                .todaySessionId(relation.getTodaySession() == null ? null : relation.getTodaySession().getId())
                .planScope(relation.getPlanScope())
                .originalFileName(asset.getOriginalFileName())
                .contentType(asset.getContentType())
                .sizeBytes(asset.getSizeBytes())
                .url(asset.getUrl())
                .downloadUrl(asset.getDownloadUrl())
                .viewUrl(asset.getViewUrl())
                .thumbnailUrl(asset.getThumbnailUrl())
                .caption(relation.getCaption())
                .sortOrder(relation.getSortOrder())
                .createdAt(relation.getCreatedAt())
                .updatedAt(relation.getUpdatedAt())
                .metadata(asset.getMetadata())
                .build();
    }

    private PlanImageTarget resolveTarget(User user, PlanScope scope, boolean requireExistingPeriodPlan) {
        PlanScope resolvedScope = scope == null ? PlanScope.DAILY : scope;
        ZoneId zone = timezoneService.resolveZone(null, user);
        if (resolvedScope == PlanScope.DAILY) {
            TodaySession session = todaySessionRepository.findByUser_IdAndSessionDate(user.getId(), LocalDate.now(zone))
                    .orElseGet(() -> createDefaultTodaySession(user, zone));
            if (session.getPlanRemovedAt() != null) {
                if (requireExistingPeriodPlan) {
                    throw new IllegalArgumentException("Create this Today Plan before uploading images");
                }
                return new PlanImageTarget(null, null);
            }
            return new PlanImageTarget(null, session);
        }

        if (resolvedScope != PlanScope.WEEKLY && resolvedScope != PlanScope.MONTHLY) {
            throw new IllegalArgumentException("Unsupported plan scope");
        }

        PeriodWindow window = resolvePeriodWindow(resolvedScope, zone);
        Plan plan = planRepository.findUserActiveByWindow(
                        PlanSource.USER,
                        resolvedScope,
                        user.getId(),
                        window.start(),
                        window.end()
                )
                .stream()
                .findFirst()
                .orElse(null);
        if (plan == null && requireExistingPeriodPlan) {
            throw new IllegalArgumentException("Create this plan before uploading images");
        }
        return new PlanImageTarget(plan, null);
    }

    private TodaySession createDefaultTodaySession(User user, ZoneId zone) {
        TodaySession session = TodaySession.builder()
                .user(user)
                .sessionDate(LocalDate.now(zone))
                .profitTarget(BigDecimal.ZERO)
                .lossLimit(BigDecimal.ZERO)
                .maxTrades(1)
                .stopAfterTargetReached(Boolean.FALSE)
                .stopAfterMaxLossReached(Boolean.TRUE)
                .status(TodaySessionStatus.ACTIVE)
                .liveModeOnly(Boolean.TRUE)
                .build();
        return todaySessionRepository.save(session);
    }

    private PeriodWindow resolvePeriodWindow(PlanScope scope, ZoneId zone) {
        ZoneId resolvedZone = zone == null ? ZoneId.of(TimezoneService.DEFAULT_TIMEZONE) : zone;
        LocalDate today = LocalDate.now(resolvedZone);
        if (scope == PlanScope.WEEKLY) {
            LocalDate start = today.with(WeekFields.ISO.dayOfWeek(), 1);
            LocalDate end = start.plusDays(6);
            return new PeriodWindow(
                    start.atStartOfDay(resolvedZone).toOffsetDateTime(),
                    end.plusDays(1).atStartOfDay(resolvedZone).minusNanos(1).toOffsetDateTime()
            );
        }
        LocalDate start = today.withDayOfMonth(1);
        LocalDate end = start.plusMonths(1).minusDays(1);
        return new PeriodWindow(
                start.atStartOfDay(resolvedZone).toOffsetDateTime(),
                end.plusDays(1).atStartOfDay(resolvedZone).minusNanos(1).toOffsetDateTime()
        );
    }

    private List<MultipartFile> normalizeFiles(List<MultipartFile> files) {
        if (files == null) {
            return List.of();
        }
        return files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();
    }

    private void validateImageCandidate(MultipartFile file) {
        String contentType = file.getContentType();
        if (StringUtils.hasText(contentType) && contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            return;
        }
        String name = file.getOriginalFilename();
        if (name != null && name.toLowerCase(Locale.ROOT).matches(".*\\.(png|jpe?g|webp|gif)$")) {
            return;
        }
        throw new IllegalArgumentException("Only image files can be uploaded to plans");
    }

    private record PlanImageTarget(Plan plan, TodaySession todaySession) {
    }

    private record PeriodWindow(OffsetDateTime start, OffsetDateTime end) {
    }
}
