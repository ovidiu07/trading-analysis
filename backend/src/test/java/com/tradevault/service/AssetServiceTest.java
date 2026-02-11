package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.config.StorageS3Properties;
import com.tradevault.config.UploadProperties;
import com.tradevault.domain.entity.Asset;
import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.AssetScope;
import com.tradevault.domain.enums.Role;
import com.tradevault.dto.asset.AssetUploadRequest;
import com.tradevault.repository.AssetRepository;
import com.tradevault.repository.ContentAssetRepository;
import com.tradevault.repository.ContentPostRepository;
import com.tradevault.repository.NotebookAttachmentRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.service.storage.ObjectStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AssetServiceTest {

    private AssetRepository assetRepository;
    private ContentAssetRepository contentAssetRepository;
    private NotebookAttachmentRepository notebookAttachmentRepository;
    private ContentPostRepository contentPostRepository;
    private NotebookNoteRepository notebookNoteRepository;
    private CurrentUserService currentUserService;
    private ObjectStorageService objectStorageService;
    private UploadProperties uploadProperties;
    private StorageS3Properties storageS3Properties;
    private AssetService assetService;

    @BeforeEach
    void setup() {
        assetRepository = mock(AssetRepository.class);
        contentAssetRepository = mock(ContentAssetRepository.class);
        notebookAttachmentRepository = mock(NotebookAttachmentRepository.class);
        contentPostRepository = mock(ContentPostRepository.class);
        notebookNoteRepository = mock(NotebookNoteRepository.class);
        currentUserService = mock(CurrentUserService.class);
        objectStorageService = mock(ObjectStorageService.class);

        uploadProperties = new UploadProperties();
        uploadProperties.setMaxFileSizeMb(1);
        uploadProperties.setAllowedMimeTypes(List.of("image/png", "application/pdf"));

        storageS3Properties = new StorageS3Properties();
        storageS3Properties.setBucket("unit-test");
        storageS3Properties.getPresign().setEnabled(false);

        assetService = new AssetService(
                assetRepository,
                contentAssetRepository,
                notebookAttachmentRepository,
                contentPostRepository,
                notebookNoteRepository,
                currentUserService,
                objectStorageService,
                new ObjectMapper(),
                uploadProperties,
                storageS3Properties
        );

        User admin = User.builder()
                .id(UUID.randomUUID())
                .role(Role.ADMIN)
                .email("admin@test.com")
                .passwordHash("x")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(admin);
    }

    @Test
    void rejectsFileAboveConfiguredLimit() {
        byte[] content = new byte[(int) (uploadProperties.getMaxFileSizeBytes() + 1)];
        MockMultipartFile file = new MockMultipartFile("file", "oversize.png", "image/png", content);
        AssetUploadRequest request = new AssetUploadRequest();
        request.setScope(AssetScope.CONTENT);
        request.setContentId(UUID.randomUUID());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> assetService.upload(file, request));
        assertEquals("File is too large", ex.getMessage());
        verifyNoInteractions(objectStorageService);
    }

    @Test
    void rejectsDisallowedMimeType() {
        MockMultipartFile file = new MockMultipartFile("file", "script.exe", "application/octet-stream", "abc".getBytes());
        AssetUploadRequest request = new AssetUploadRequest();
        request.setScope(AssetScope.CONTENT);
        request.setContentId(UUID.randomUUID());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> assetService.upload(file, request));
        assertEquals("File type is not allowed", ex.getMessage());
        verifyNoInteractions(objectStorageService);
    }

    @Test
    void generatesScopeKeyAndPersistsContentAsset() {
        UUID contentId = UUID.randomUUID();
        ContentPost post = new ContentPost();
        post.setId(contentId);
        when(contentPostRepository.findById(contentId)).thenReturn(Optional.of(post));

        when(assetRepository.save(any())).thenAnswer(invocation -> {
            Asset input = invocation.getArgument(0, Asset.class);
            input.setId(UUID.randomUUID());
            input.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
            return input;
        });

        MockMultipartFile file = new MockMultipartFile("file", "plan.png", "image/png", "png".getBytes());
        AssetUploadRequest request = new AssetUploadRequest();
        request.setScope(AssetScope.CONTENT);
        request.setContentId(contentId);

        var response = assetService.upload(file, request);

        verify(objectStorageService).putObject(anyString(), any(), anyString());
        verify(contentAssetRepository).save(any());
        assertEquals(contentId, response.getContentId());
        assertTrue(response.getId() != null);
    }

    @Test
    void buildS3KeyUsesScopeAndDatePartitions() {
        String key = assetService.buildS3Key(AssetScope.NOTEBOOK, "note.png");
        LocalDate now = LocalDate.now(ZoneOffset.UTC);
        String prefix = "notebook/%d/%02d/".formatted(now.getYear(), now.getMonthValue());
        assertTrue(key.startsWith(prefix));
        assertTrue(key.endsWith("-note.png"));
    }
}
