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
import com.tradevault.dto.notebook.NotebookNoteSummaryResponse;
import com.tradevault.repository.NotebookFolderRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.NotebookTagLinkRepository;
import com.tradevault.repository.NotebookTagRepository;
import com.tradevault.repository.TradeRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.AbstractMap;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotebookNoteService {
    private static final Safelist NOTE_BODY_SAFELIST = Safelist.relaxed()
            .addTags("hr", "pre", "code", "label", "input", "span")
            .addAttributes("a", "rel", "target")
            .addAttributes("input", "type", "checked", "disabled")
            .addAttributes("ul", "data-type")
            .addAttributes("li", "data-type")
            .addAttributes("label", "data-type")
            .removeTags("img");
    private static final ZoneId DISPLAY_ZONE = ZoneId.of("Europe/Bucharest");

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
                                          LocalDate from,
                                          LocalDate to,
                                          String sort) {
        User user = currentUserService.getCurrentUser();
        NotebookFolder folder = null;
        if (folderId != null) {
            folder = folderRepository.findByIdAndUserId(folderId, user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Folder not found"));
        }

        Boolean isDeleted = null;

        // IMPORTANT: This must remain effectively final for lambda capture.
        // We therefore mutate an EnumSet rather than reassigning a local variable.
        EnumSet<NotebookNoteType> typeFilter = EnumSet.noneOf(NotebookNoteType.class);

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
                        typeFilter.add(NotebookNoteType.PLAN);
                        typeFilter.add(NotebookNoteType.GOAL);
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
            notes = noteRepository.searchNotesByTags(
                    user.getId(),
                    type,
                    resolvedFolderId,
                    from,
                    to,
                    isDeleted,
                    query,
                    tagIds,
                    resolvedSort
            );
        } else {
            notes = noteRepository.searchNotes(
                    user.getId(),
                    type,
                    resolvedFolderId,
                    from,
                    to,
                    isDeleted,
                    query,
                    resolvedSort
            );
        }

        // Only apply this extra filter when we are in SYSTEM_PLANS_GOALS and caller did not pass a specific type.
        if (!typeFilter.isEmpty()) {
            notes = notes.stream().filter(n -> typeFilter.contains(n.getType())).toList();
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

    @Transactional(readOnly = true)
    public List<NotebookNoteSummaryResponse> listByDate(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : to;
        LocalDate end = to != null ? to : from;
        if (start == null || end == null) {
            throw new IllegalArgumentException("from and to are required");
        }
        if (end.isBefore(start)) {
            throw new IllegalArgumentException("to must be on or after from");
        }
        User user = currentUserService.getCurrentUser();
        List<NotebookNote> notes = noteRepository.findByUserIdAndIsDeletedFalse(user.getId());

        return notes.stream()
                .map(note -> new AbstractMap.SimpleEntry<>(note, resolveJournalDate(note)))
                .filter(entry -> entry.getValue() != null
                        && !entry.getValue().isBefore(start)
                        && !entry.getValue().isAfter(end))
                .sorted(Comparator
                        .comparing((AbstractMap.SimpleEntry<NotebookNote, LocalDate> entry) -> entry.getValue())
                        .thenComparing(entry -> entry.getKey().getCreatedAt(), Comparator.nullsLast(Comparator.naturalOrder())))
                .map(entry -> {
                    NotebookNote note = entry.getKey();
                    LocalDate journalDate = entry.getValue();
                    return NotebookNoteSummaryResponse.builder()
                            .id(note.getId())
                            .title(resolveTitle(note))
                            .type(note.getType())
                            .journalDate(journalDate)
                            .createdAt(note.getCreatedAt())
                            .build();
                })
                .toList();
    }

    private void applyRequest(NotebookNote note, NotebookNoteRequest request, User user) {
        if (request.getType() != null && request.getType() != note.getType()) {
            note.setType(request.getType());
        } else if (note.getType() == null) {
            note.setType(NotebookNoteType.NOTE);
        }
        if (request.getFolderId() != null) {
            NotebookFolder folder = folderRepository.findByIdAndUserId(request.getFolderId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Folder not found"));
            if (note.getFolder() == null || !Objects.equals(note.getFolder().getId(), folder.getId())) {
                note.setFolder(folder);
            }
        }
        if (request.getTitle() != null && !Objects.equals(note.getTitle(), request.getTitle())) {
            note.setTitle(request.getTitle());
        }
        if (request.getBody() != null) {
            String sanitized = sanitizeHtml(request.getBody());
            if (!Objects.equals(note.getBody(), sanitized)) {
                note.setBody(sanitized);
            }
        }
        if (request.getBodyJson() != null && !Objects.equals(note.getBodyJson(), request.getBodyJson())) {
            note.setBodyJson(request.getBodyJson());
        }
        if (request.getDateKey() != null && !Objects.equals(note.getDateKey(), request.getDateKey())) {
            note.setDateKey(request.getDateKey());
        }
        if (request.getRelatedTradeId() != null) {
            Trade trade = tradeRepository.findByIdAndUserId(request.getRelatedTradeId(), user.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Trade not found"));
            if (note.getRelatedTrade() == null || !Objects.equals(note.getRelatedTrade().getId(), trade.getId())) {
                note.setRelatedTrade(trade);
            }
        }
        if (request.getIsPinned() != null && request.getIsPinned() != note.isPinned()) {
            note.setPinned(request.getIsPinned());
        }
    }

    private String sanitizeHtml(String html) {
        return Jsoup.clean(html, NOTE_BODY_SAFELIST);
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
                .isPinned(note.isPinned())
                .createdAt(note.getCreatedAt())
                .updatedAt(note.getUpdatedAt())
                .tagIds(tagIds)
                .build();
    }

    private LocalDate resolveJournalDate(NotebookNote note) {
        if (note.getDateKey() != null) {
            return note.getDateKey();
        }
        if (note.getCreatedAt() == null) {
            return null;
        }
        return note.getCreatedAt().atZoneSameInstant(DISPLAY_ZONE).toLocalDate();
    }

    private String resolveTitle(NotebookNote note) {
        if (note.getTitle() != null && !note.getTitle().isBlank()) {
            return note.getTitle();
        }
        return "Untitled note";
    }

    private Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Order.desc("isPinned"), Sort.Order.desc("updatedAt"));
        }
        return switch (sort) {
            case "date" -> Sort.by(Sort.Order.desc("isPinned"), Sort.Order.desc("dateKey"), Sort.Order.desc("updatedAt"));
            case "created" -> Sort.by(Sort.Order.desc("isPinned"), Sort.Order.desc("createdAt"));
            default -> Sort.by(Sort.Order.desc("isPinned"), Sort.Order.desc("updatedAt"));
        };
    }
}
