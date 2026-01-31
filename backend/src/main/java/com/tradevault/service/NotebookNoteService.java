package com.tradevault.service;

import com.tradevault.domain.entity.NotebookFolder;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.NotebookTag;
import com.tradevault.domain.entity.NotebookTagLink;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.domain.enums.NotebookTagEntityType;
import com.tradevault.dto.notebook.NotebookNoteRequest;
import com.tradevault.dto.notebook.NotebookNoteResponse;
import com.tradevault.repository.NotebookFolderRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.NotebookTagLinkRepository;
import com.tradevault.repository.NotebookTagRepository;
import com.tradevault.repository.TradeRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotebookNoteService {
    private final NotebookNoteRepository noteRepository;
    private final NotebookFolderRepository folderRepository;
    private final NotebookTagRepository tagRepository;
    private final NotebookTagLinkRepository tagLinkRepository;
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;

    @Transactional
    public List<NotebookNoteResponse> list(UUID folderId,
                                           NotebookNoteType type,
                                           String query,
                                           List<UUID> tagIds,
                                           java.time.LocalDate from,
                                           java.time.LocalDate to,
                                           String sort) {
        User user = currentUserService.getCurrentUser();
        NotebookFolder folder = null;
        if (folderId != null) {
            folder = folderRepository.findByIdAndUserId(folderId, user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Folder not found"));
        }

        Boolean isDeleted = null;
        List<NotebookNoteType> types = null;
        UUID resolvedFolderId = folderId;

        if (folder != null && folder.getSystemKey() != null) {
            resolvedFolderId = null;
            switch (folder.getSystemKey()) {
                case NotebookFolderService.SYSTEM_ALL_NOTES -> {
                    isDeleted = false;
                }
                case NotebookFolderService.SYSTEM_RECENTLY_DELETED -> {
                    isDeleted = true;
                }
                case NotebookFolderService.SYSTEM_DAILY_JOURNAL -> {
                    isDeleted = false;
                    type = NotebookNoteType.DAILY_LOG;
                }
                case NotebookFolderService.SYSTEM_TRADE_NOTES -> {
                    isDeleted = false;
                    type = NotebookNoteType.TRADE_NOTE;
                }
                case NotebookFolderService.SYSTEM_PLANS_GOALS -> {
                    isDeleted = false;
                    if (type == null) {
                        types = List.of(NotebookNoteType.PLAN, NotebookNoteType.GOAL);
                    }
                }
                case NotebookFolderService.SYSTEM_SESSIONS_RECAP -> {
                    isDeleted = false;
                    type = NotebookNoteType.SESSION_RECAP;
                }
                default -> isDeleted = false;
            }
        } else {
            isDeleted = false;
        }

        Sort resolvedSort = resolveSort(sort);
        List<NotebookNote> notes;
        if (tagIds != null && !tagIds.isEmpty()) {
            notes = noteRepository.searchNotesByTags(user.getId(), type, resolvedFolderId, from, to, isDeleted, query, tagIds, resolvedSort);
        } else {
            notes = noteRepository.searchNotes(user.getId(), type, resolvedFolderId, from, to, isDeleted, query, resolvedSort);
        }

        if (types != null && !types.isEmpty()) {
            notes = notes.stream().filter(n -> types.contains(n.getType())).toList();
        }

        Map<UUID, List<UUID>> noteTags = loadTagIds(notes);
        return notes.stream()
                .map(note -> toResponse(note, noteTags.getOrDefault(note.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public NotebookNoteResponse get(UUID id) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        List<UUID> tagIds = tagLinkRepository.findByNoteId(note.getId()).stream()
                .map(link -> link.getTag().getId())
                .toList();
        return toResponse(note, tagIds);
    }

    @Transactional
    public NotebookNoteResponse create(NotebookNoteRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = new NotebookNote();
        applyRequest(note, request, user);
        note.setUser(user);
        note.setDeleted(false);
        NotebookNote saved = noteRepository.save(note);
        replaceTags(saved, request.getTagIds(), user);
        return get(saved.getId());
    }

    @Transactional
    public NotebookNoteResponse update(UUID id, NotebookNoteRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        applyRequest(note, request, user);
        NotebookNote saved = noteRepository.save(note);
        if (request.getTagIds() != null) {
            replaceTags(saved, request.getTagIds(), user);
        }
        return get(saved.getId());
    }

    @Transactional
    public void delete(UUID id) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        note.setDeleted(true);
        note.setDeletedAt(OffsetDateTime.now());
        noteRepository.save(note);
    }

    @Transactional
    public NotebookNoteResponse restore(UUID id) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        note.setDeleted(false);
        note.setDeletedAt(null);
        NotebookNote saved = noteRepository.save(note);
        return get(saved.getId());
    }

    @Transactional
    public NotebookNoteResponse updateTags(UUID noteId, List<UUID> tagIds) {
        User user = currentUserService.getCurrentUser();
        NotebookNote note = noteRepository.findByIdAndUserId(noteId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Note not found"));
        replaceTags(note, tagIds, user);
        return get(note.getId());
    }

    private void applyRequest(NotebookNote note, NotebookNoteRequest request, User user) {
        if (request.getType() != null) {
            note.setType(request.getType());
        } else if (note.getType() == null) {
            note.setType(NotebookNoteType.NOTE);
        }
        if (request.getFolderId() != null) {
            NotebookFolder folder = folderRepository.findByIdAndUserId(request.getFolderId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Folder not found"));
            note.setFolder(folder);
        }
        if (request.getTitle() != null) {
            note.setTitle(request.getTitle());
        }
        if (request.getBody() != null) {
            note.setBody(request.getBody());
        }
        if (request.getBodyJson() != null) {
            note.setBodyJson(request.getBodyJson());
        }
        if (request.getDateKey() != null) {
            note.setDateKey(request.getDateKey());
        }
        if (request.getRelatedTradeId() != null) {
            Trade trade = tradeRepository.findByIdAndUserId(request.getRelatedTradeId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
            note.setRelatedTrade(trade);
        }
    }

    private void replaceTags(NotebookNote note, List<UUID> tagIds, User user) {
        tagLinkRepository.deleteByNoteId(note.getId());
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        List<NotebookTag> tags = tagRepository.findAllById(tagIds)
                .stream()
                .filter(tag -> tag.getUser().getId().equals(user.getId()))
                .toList();
        List<NotebookTagLink> links = tags.stream()
                .map(tag -> NotebookTagLink.builder()
                        .user(user)
                        .tag(tag)
                        .note(note)
                        .entityType(NotebookTagEntityType.NOTE)
                        .build())
                .toList();
        tagLinkRepository.saveAll(links);
    }

    private Map<UUID, List<UUID>> loadTagIds(List<NotebookNote> notes) {
        if (notes.isEmpty()) {
            return Map.of();
        }
        List<UUID> noteIds = notes.stream().map(NotebookNote::getId).toList();
        return tagLinkRepository.findByNoteIdIn(noteIds).stream()
                .collect(Collectors.groupingBy(link -> link.getNote().getId(),
                        Collectors.mapping(link -> link.getTag().getId(), Collectors.toList())));
    }

    private NotebookNoteResponse toResponse(NotebookNote note, List<UUID> tagIds) {
        return NotebookNoteResponse.builder()
                .id(note.getId())
                .type(note.getType())
                .folderId(note.getFolder() != null ? note.getFolder().getId() : null)
                .title(note.getTitle())
                .body(note.getBody())
                .bodyJson(note.getBodyJson())
                .dateKey(note.getDateKey())
                .relatedTradeId(note.getRelatedTrade() != null ? note.getRelatedTrade().getId() : null)
                .isDeleted(note.isDeleted())
                .deletedAt(note.getDeletedAt())
                .createdAt(note.getCreatedAt())
                .updatedAt(note.getUpdatedAt())
                .tagIds(tagIds)
                .build();
    }

    private Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "updatedAt");
        }
        return switch (sort) {
            case "date" -> Sort.by(Sort.Direction.DESC, "dateKey", "updatedAt");
            case "created" -> Sort.by(Sort.Direction.DESC, "createdAt");
            default -> Sort.by(Sort.Direction.DESC, "updatedAt");
        };
    }
}
