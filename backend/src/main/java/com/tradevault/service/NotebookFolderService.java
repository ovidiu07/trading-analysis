package com.tradevault.service;

import com.tradevault.domain.entity.NotebookFolder;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.notebook.NotebookFolderRequest;
import com.tradevault.dto.notebook.NotebookFolderResponse;
import com.tradevault.repository.NotebookFolderRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotebookFolderService {
    public static final String SYSTEM_ALL_NOTES = "ALL_NOTES";
    public static final String SYSTEM_DAILY_JOURNAL = "DAILY_JOURNAL";
    public static final String SYSTEM_TRADE_NOTES = "TRADE_NOTES";
    public static final String SYSTEM_PLANS_GOALS = "PLANS_GOALS";
    public static final String SYSTEM_SESSIONS_RECAP = "SESSIONS_RECAP";
    public static final String SYSTEM_RECENTLY_DELETED = "RECENTLY_DELETED";

    private final NotebookFolderRepository folderRepository;
    private final CurrentUserService currentUserService;

    @Transactional
    public List<NotebookFolderResponse> list() {
        User user = currentUserService.getCurrentUser();
        ensureSystemFolders(user);
        return folderRepository.findByUserIdOrderBySortOrderAscNameAsc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public NotebookFolderResponse create(NotebookFolderRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookFolder folder = new NotebookFolder();
        folder.setUser(user);
        folder.setName(request.getName());
        folder.setSortOrder(request.getSortOrder());
        if (request.getParentId() != null) {
            NotebookFolder parent = folderRepository.findByIdAndUserId(request.getParentId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Parent folder not found"));
            folder.setParent(parent);
        }
        return toResponse(folderRepository.save(folder));
    }

    @Transactional
    public NotebookFolderResponse update(UUID id, NotebookFolderRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookFolder folder = folderRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Folder not found"));
        if (folder.getSystemKey() != null) {
            throw new IllegalStateException("System folders cannot be modified");
        }
        if (request.getName() != null) {
            folder.setName(request.getName());
        }
        if (request.getSortOrder() != null) {
            folder.setSortOrder(request.getSortOrder());
        }
        if (request.getParentId() != null) {
            NotebookFolder parent = folderRepository.findByIdAndUserId(request.getParentId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Parent folder not found"));
            folder.setParent(parent);
        }
        return toResponse(folderRepository.save(folder));
    }

    @Transactional
    public void delete(UUID id) {
        User user = currentUserService.getCurrentUser();
        NotebookFolder folder = folderRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Folder not found"));
        if (folder.getSystemKey() != null) {
            throw new IllegalStateException("System folders cannot be deleted");
        }
        folderRepository.delete(folder);
    }

    public NotebookFolderResponse toResponse(NotebookFolder folder) {
        return NotebookFolderResponse.builder()
                .id(folder.getId())
                .name(folder.getName())
                .parentId(folder.getParent() != null ? folder.getParent().getId() : null)
                .sortOrder(folder.getSortOrder())
                .systemKey(folder.getSystemKey())
                .createdAt(folder.getCreatedAt())
                .updatedAt(folder.getUpdatedAt())
                .build();
    }

    private void ensureSystemFolders(User user) {
        Map<String, String> systemFolders = new LinkedHashMap<>();
        systemFolders.put(SYSTEM_ALL_NOTES, "All notes");
        systemFolders.put(SYSTEM_DAILY_JOURNAL, "Daily journal");
        systemFolders.put(SYSTEM_TRADE_NOTES, "Trade notes");
        systemFolders.put(SYSTEM_PLANS_GOALS, "Plans & goals");
        systemFolders.put(SYSTEM_SESSIONS_RECAP, "Sessions recap");
        systemFolders.put(SYSTEM_RECENTLY_DELETED, "Recently deleted");

        int index = 0;
        for (var entry : systemFolders.entrySet()) {
            String key = entry.getKey();
            if (folderRepository.findByUserIdAndSystemKey(user.getId(), key).isPresent()) {
                index++;
                continue;
            }
            NotebookFolder folder = new NotebookFolder();
            folder.setUser(user);
            folder.setName(entry.getValue());
            folder.setSystemKey(key);
            folder.setSortOrder(index++);
            folderRepository.save(folder);
        }
    }
}
