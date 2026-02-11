package com.tradevault.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.config.StorageS3Properties;
import com.tradevault.config.UploadProperties;
import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.ContentAsset;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.NotebookAttachment;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.domain.enums.ContentPostStatus;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.asset.AssetResponse;
import com.tradevault.dto.asset.AssetUploadRequest;
import com.tradevault.repository.AssetRepository;
import com.tradevault.repository.ContentAssetRepository;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.NotebookAttachmentRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.service.storage.ObjectStorageService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URLConnection;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@Service
@RequiredArgsConstructor
public class AssetService {
    private static final TypeReference<Map<String, Object>> METADATA_MAP = new TypeReference<>() {};

    private final AssetRepository assetRepository;
    private final ContentAssetRepository contentAssetRepository;
    private final NotebookAttachmentRepository notebookAttachmentRepository;
    private final ContentPostRepository contentPostRepository;
    private final NotebookNoteRepository notebookNoteRepository;
    private final CurrentUserService currentUserService;
    private final ObjectStorageService objectStorageService;
    private final ObjectMapper objectMapper;
    private final UploadProperties uploadProperties;
    private final StorageS3Properties storageS3Properties;

    @Transactional
    public AssetResponse upload(MultipartFile file, AssetUploadRequest request) {
        User user = currentUserService.getCurrentUser();
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read uploaded file");
        }

        String detectedContentType = detectContentType(file, bytes);
        validateUpload(file.getSize(), detectedContentType);

        String originalName = sanitizeFileName(file.getOriginalFilename());
        String s3Key = buildS3Key(request.getScope(), originalName);
        String metadataJson = buildMetadataJson(detectedContentType, bytes);

        UUID contentId = null;
        UUID noteId = null;
        int sortOrder = request.getSortOrder() != null ? request.getSortOrder() : 0;
        ContentPost post = null;
        NotebookNote note = null;

        if (request.getScope() == AssetScope.CONTENT) {
            requireAdmin(user);
            contentId = requireField(request.getContentId(), "contentId is required for CONTENT assets");
            post = contentPostRepository.findById(contentId)
                    .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        } else if (request.getScope() == AssetScope.NOTEBOOK) {
            noteId = requireField(request.getNoteId(), "noteId is required for NOTEBOOK assets");
            note = resolveNotebookNoteForWrite(noteId, user);
        } else {
            throw new IllegalArgumentException("Unsupported asset scope");
        }

        objectStorageService.putObject(s3Key, bytes, detectedContentType);

        try {
            Asset asset = Asset.builder()
                    .ownerUser(note != null ? note.getUser() : (isAdmin(user) ? user : null))
                    .scope(request.getScope())
                    .originalFileName(originalName)
                    .contentType(detectedContentType)
                    .sizeBytes(file.getSize())
                    .s3Key(s3Key)
                    .metadata(metadataJson)
                    .build();
            Asset saved = assetRepository.save(asset);

            if (request.getScope() == AssetScope.CONTENT) {
                ContentAsset relation = ContentAsset.builder()
                        .contentPost(post)
                        .asset(saved)
                        .sortOrder(sortOrder)
                        .build();
                contentAssetRepository.save(relation);
            } else if (request.getScope() == AssetScope.NOTEBOOK) {
                NotebookAttachment relation = NotebookAttachment.builder()
                        .note(note)
                        .user(note.getUser())
                        .asset(saved)
                        .sortOrder(sortOrder)
                        .build();
                notebookAttachmentRepository.save(relation);
            }

            return toResponse(saved, contentId, noteId);
        } catch (RuntimeException ex) {
            safeDeleteFromStorage(s3Key);
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> listByContent(UUID contentId) {
        User user = currentUserService.getCurrentUser();
        ContentPost post = contentPostRepository.findById(contentId)
                .orElseThrow(() -> new EntityNotFoundException("Content not found"));
        if (!isAdmin(user) && !isVisibleToUsers(post, OffsetDateTime.now())) {
            throw new EntityNotFoundException("Content not found");
        }
        return contentAssetRepository.findByContentPostIdOrderBySortOrderAscCreatedAtAsc(contentId).stream()
                .map(relation -> toResponse(relation.getAsset(), relation.getContentPost().getId(), null))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> listByNote(UUID noteId) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = resolveNotebookNoteForRead(noteId, user);
        return notebookAttachmentRepository.findByNoteIdOrderBySortOrderAscCreatedAtAsc(note.getId()).stream()
                .map(relation -> toResponse(relation.getAsset(), null, relation.getNote().getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<AssetResponse>> mapByContentPosts(Collection<ContentPost> posts) {
        List<UUID> ids = posts.stream().map(ContentPost::getId).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<ContentAsset> rows = contentAssetRepository.findByContentPostIdInOrderBySortOrderAscCreatedAtAsc(ids);
        Map<UUID, List<AssetResponse>> byContent = new LinkedHashMap<>();
        for (ContentAsset row : rows) {
            byContent.computeIfAbsent(row.getContentPost().getId(), ignored -> new ArrayList<>())
                    .add(toResponse(row.getAsset(), row.getContentPost().getId(), null));
        }
        return byContent;
    }

    @Transactional
    public void deleteAsset(UUID assetId) {
        User user = currentUserService.getCurrentUser();
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new EntityNotFoundException("Asset not found"));
        assertCanDelete(asset, user);

        contentAssetRepository.deleteByAssetId(assetId);
        notebookAttachmentRepository.deleteByAssetId(assetId);
        assetRepository.delete(asset);
        objectStorageService.deleteObject(asset.getS3Key());
    }

    @Transactional
    public void deleteAssetsForContent(UUID contentId) {
        List<UUID> assetIds = contentAssetRepository.findByContentPostIdOrderBySortOrderAscCreatedAtAsc(contentId).stream()
                .map(relation -> relation.getAsset().getId())
                .toList();
        for (UUID assetId : assetIds) {
            deleteAsset(assetId);
        }
    }

    @Transactional(readOnly = true)
    public ResponseEntity<?> download(UUID assetId, boolean inline) {
        User user = currentUserService.getCurrentUser();
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new EntityNotFoundException("Asset not found"));
        assertCanRead(asset, user);

        String directUrl = resolveDirectAssetUrl(asset, inline);
        if (directUrl != null) {
            return ResponseEntity.status(302)
                    .header(HttpHeaders.LOCATION, directUrl)
                    .build();
        }

        ObjectStorageService.StoredObject storedObject = objectStorageService.getObject(asset.getS3Key());
        MediaType mediaType = parseMediaType(storedObject.contentType());
        ContentDisposition disposition = inline
                ? ContentDisposition.inline().filename(asset.getOriginalFileName()).build()
                : ContentDisposition.attachment().filename(asset.getOriginalFileName()).build();

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString());
        if (storedObject.contentLength() != null && storedObject.contentLength() >= 0) {
            builder.contentLength(storedObject.contentLength());
        }
        return builder.body(new InputStreamResource(storedObject.stream()));
    }

    private NotebookNote resolveNotebookNoteForWrite(UUID noteId, User currentUser) {
        if (isAdmin(currentUser)) {
            return notebookNoteRepository.findById(noteId)
                    .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        }
        return notebookNoteRepository.findByIdAndUserId(noteId, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
    }

    private NotebookNote resolveNotebookNoteForRead(UUID noteId, User currentUser) {
        if (isAdmin(currentUser)) {
            return notebookNoteRepository.findById(noteId)
                    .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        }
        return notebookNoteRepository.findByIdAndUserId(noteId, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
    }

    private void assertCanDelete(Asset asset, User user) {
        if (asset.getScope() == AssetScope.CONTENT) {
            requireAdmin(user);
            return;
        }
        if (asset.getScope() == AssetScope.NOTEBOOK) {
            if (isAdmin(user)) {
                return;
            }
            NotebookAttachment attachment = notebookAttachmentRepository.findByAssetId(asset.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Asset not found"));
            if (!Objects.equals(attachment.getUser().getId(), user.getId())) {
                throw new ResponseStatusException(FORBIDDEN, "Forbidden");
            }
            return;
        }
        throw new ResponseStatusException(FORBIDDEN, "Forbidden");
    }

    private void assertCanRead(Asset asset, User user) {
        if (asset.getScope() == AssetScope.CONTENT) {
            if (isAdmin(user)) {
                return;
            }
            List<ContentAsset> relations = contentAssetRepository.findByAssetId(asset.getId());
            boolean visible = relations.stream()
                    .map(ContentAsset::getContentPost)
                    .anyMatch(post -> isVisibleToUsers(post, OffsetDateTime.now()));
            if (!visible) {
                throw new EntityNotFoundException("Asset not found");
            }
            return;
        }

        if (asset.getScope() == AssetScope.NOTEBOOK) {
            if (isAdmin(user)) {
                return;
            }
            NotebookAttachment relation = notebookAttachmentRepository.findByAssetId(asset.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Asset not found"));
            if (!Objects.equals(relation.getUser().getId(), user.getId())) {
                throw new EntityNotFoundException("Asset not found");
            }
            return;
        }

        throw new EntityNotFoundException("Asset not found");
    }

    private boolean isVisibleToUsers(ContentPost post, OffsetDateTime now) {
        if (post.getStatus() != ContentPostStatus.PUBLISHED) {
            return false;
        }
        if (post.getVisibleFrom() != null && post.getVisibleFrom().isAfter(now)) {
            return false;
        }
        if (post.getVisibleUntil() != null && post.getVisibleUntil().isBefore(now)) {
            return false;
        }
        return true;
    }

    private void requireAdmin(User user) {
        if (!isAdmin(user)) {
            throw new ResponseStatusException(FORBIDDEN, "Forbidden");
        }
    }

    private boolean isAdmin(User user) {
        return user != null && user.getRole() == Role.ADMIN;
    }

    private String buildMetadataJson(String contentType, byte[] bytes) {
        if (contentType == null || !contentType.startsWith("image/")) {
            return null;
        }
        try {
            var image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) {
                return null;
            }
            Map<String, Object> metadata = Map.of(
                    "width", image.getWidth(),
                    "height", image.getHeight()
            );
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception ex) {
            return null;
        }
    }

    private void validateUpload(long sizeBytes, String detectedType) {
        long maxSize = uploadProperties.getMaxFileSizeBytes();
        if (sizeBytes <= 0) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        if (sizeBytes > maxSize) {
            throw new IllegalArgumentException("File is too large");
        }
        if (detectedType == null || detectedType.isBlank()) {
            throw new IllegalArgumentException("Could not detect file type");
        }
        List<String> allowed = uploadProperties.getAllowedMimeTypes().stream()
                .filter(Objects::nonNull)
                .map(value -> value.toLowerCase(Locale.ROOT).trim())
                .toList();
        if (!allowed.contains(detectedType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("File type is not allowed");
        }
    }

    private String detectContentType(MultipartFile file, byte[] bytes) {
        String detected = null;
        try {
            detected = URLConnection.guessContentTypeFromStream(new ByteArrayInputStream(bytes));
        } catch (IOException ignored) {
        }
        if (!StringUtils.hasText(detected) && StringUtils.hasText(file.getContentType())) {
            detected = file.getContentType();
        }
        if (!StringUtils.hasText(detected)) {
            detected = resolveMimeByExtension(file.getOriginalFilename());
        }
        if (!StringUtils.hasText(detected)) {
            detected = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        return detected.toLowerCase(Locale.ROOT);
    }

    private String resolveMimeByExtension(String fileName) {
        if (fileName == null) {
            return null;
        }
        String normalized = fileName.toLowerCase(Locale.ROOT);
        if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
        if (normalized.endsWith(".png")) return "image/png";
        if (normalized.endsWith(".webp")) return "image/webp";
        if (normalized.endsWith(".gif")) return "image/gif";
        if (normalized.endsWith(".pdf")) return "application/pdf";
        if (normalized.endsWith(".txt")) return "text/plain";
        if (normalized.endsWith(".csv")) return "text/csv";
        if (normalized.endsWith(".json")) return "application/json";
        if (normalized.endsWith(".doc")) return "application/msword";
        if (normalized.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (normalized.endsWith(".xls")) return "application/vnd.ms-excel";
        if (normalized.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return null;
    }

    private <T> T requireField(T value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private String sanitizeFileName(String original) {
        String base = StringUtils.cleanPath(original == null ? "file" : original);
        base = base.replaceAll("[\\\\/]+", "_");
        base = base.replaceAll("[^a-zA-Z0-9._-]+", "-");
        base = base.replaceAll("-{2,}", "-");
        if (base.isBlank()) {
            return "file";
        }
        return base;
    }

    String buildS3Key(AssetScope scope, String sanitizedName) {
        if (scope == null) {
            throw new IllegalArgumentException("scope is required");
        }
        LocalDate now = LocalDate.now(ZoneOffset.UTC);
        String scopeSegment = scope.name().toLowerCase(Locale.ROOT);
        return "%s/%d/%02d/%s-%s".formatted(
                scopeSegment,
                now.getYear(),
                now.getMonthValue(),
                UUID.randomUUID(),
                sanitizedName
        );
    }

    private void safeDeleteFromStorage(String key) {
        try {
            objectStorageService.deleteObject(key);
        } catch (Exception ignored) {
        }
    }

    private AssetResponse toResponse(Asset asset, UUID contentId, UUID noteId) {
        boolean image = asset.getContentType() != null && asset.getContentType().startsWith("image/");
        String viewUrl = resolveViewUrl(asset);
        String downloadUrl = resolveDownloadUrl(asset);
        String primaryUrl = image ? viewUrl : downloadUrl;
        return AssetResponse.builder()
                .id(asset.getId())
                .scope(asset.getScope())
                .contentId(contentId)
                .noteId(noteId)
                .originalFileName(asset.getOriginalFileName())
                .contentType(asset.getContentType())
                .sizeBytes(asset.getSizeBytes())
                .url(primaryUrl)
                .downloadUrl(downloadUrl)
                .viewUrl(viewUrl)
                .thumbnailUrl(image ? viewUrl : null)
                .image(image)
                .createdAt(asset.getCreatedAt())
                .metadata(readMetadata(asset.getMetadata()))
                .build();
    }

    private Map<String, Object> readMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(metadata, METADATA_MAP);
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private String resolveViewUrl(Asset asset) {
        String direct = resolveDirectAssetUrl(asset, true);
        if (direct != null) {
            return direct;
        }
        return "/api/assets/" + asset.getId() + "/view";
    }

    private String resolveDownloadUrl(Asset asset) {
        String direct = resolveDirectAssetUrl(asset, false);
        if (direct != null) {
            return direct;
        }
        return "/api/assets/" + asset.getId() + "/download";
    }

    private String resolveDirectAssetUrl(Asset asset, boolean inline) {
        StorageS3Properties s3 = storageS3Properties;
        if (s3.getPresign().isEnabled()) {
            int expirationMinutes = Math.max(1, s3.getPresign().getExpirationMinutes());
            return objectStorageService.presignGetObjectUrl(asset.getS3Key(), Duration.ofMinutes(expirationMinutes));
        }
        if (s3.getPublicBaseUrl() != null && !s3.getPublicBaseUrl().isBlank()) {
            String base = s3.getPublicBaseUrl().replaceAll("/+$", "");
            String key = asset.getS3Key().replaceFirst("^/+", "");
            return base + "/" + key;
        }
        if (inline) {
            return null;
        }
        return null;
    }

    private MediaType parseMediaType(String raw) {
        if (raw == null || raw.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            return MediaType.parseMediaType(raw);
        } catch (Exception ex) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
