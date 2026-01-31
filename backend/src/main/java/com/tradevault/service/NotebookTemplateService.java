package com.tradevault.service;

import com.tradevault.domain.entity.NotebookTemplate;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.dto.notebook.NotebookTemplateRequest;
import com.tradevault.dto.notebook.NotebookTemplateResponse;
import com.tradevault.repository.NotebookTemplateRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotebookTemplateService {
    private final NotebookTemplateRepository templateRepository;
    private final CurrentUserService currentUserService;

    @Transactional
    public List<NotebookTemplateResponse> list(NotebookNoteType type) {
        User user = currentUserService.getCurrentUser();
        ensureDefaultTemplates(user);
        List<NotebookTemplate> templates = type == null
                ? templateRepository.findByUserIdOrderByUpdatedAtDesc(user.getId())
                : templateRepository.findByUserIdAndAppliesToTypeOrderByUpdatedAtDesc(user.getId(), type);
        return templates.stream().map(this::toResponse).toList();
    }

    @Transactional
    public NotebookTemplateResponse create(NotebookTemplateRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookTemplate template = NotebookTemplate.builder()
                .user(user)
                .name(request.getName())
                .appliesToType(request.getAppliesToType())
                .content(request.getContent())
                .build();
        return toResponse(templateRepository.save(template));
    }

    @Transactional
    public NotebookTemplateResponse update(UUID id, NotebookTemplateRequest request) {
        User user = currentUserService.getCurrentUser();
        NotebookTemplate template = templateRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Template not found"));
        if (request.getName() != null) {
            template.setName(request.getName());
        }
        if (request.getAppliesToType() != null) {
            template.setAppliesToType(request.getAppliesToType());
        }
        if (request.getContent() != null) {
            template.setContent(request.getContent());
        }
        return toResponse(templateRepository.save(template));
    }

    @Transactional
    public void delete(UUID id) {
        User user = currentUserService.getCurrentUser();
        NotebookTemplate template = templateRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Template not found"));
        templateRepository.delete(template);
    }

    private NotebookTemplateResponse toResponse(NotebookTemplate template) {
        return NotebookTemplateResponse.builder()
                .id(template.getId())
                .name(template.getName())
                .appliesToType(template.getAppliesToType())
                .content(template.getContent())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    private void ensureDefaultTemplates(User user) {
        if (templateRepository.existsByUserId(user.getId())) {
            return;
        }
        List<NotebookTemplate> defaults = new ArrayList<>();
        defaults.add(NotebookTemplate.builder()
                .user(user)
                .name("Daily Log")
                .appliesToType(NotebookNoteType.DAILY_LOG)
                .content("""
                        ## Pre-market checklist
                        - [ ] Macro news scan
                        - [ ] Key levels mapped
                        - [ ] Risk limits confirmed

                        ## Watchlist
                        - Ticker: Thesis / Levels

                        ## Post-session review
                        **What went well?**
                        - 

                        **What needs work?**
                        - 

                        ## Mistakes & lessons
                        - 
                        """)
                .build());
        defaults.add(NotebookTemplate.builder()
                .user(user)
                .name("Trading Plan")
                .appliesToType(NotebookNoteType.PLAN)
                .content("""
                        ## Thesis
                        - 

                        ## Setups
                        - 

                        ## Risk rules
                        - Max daily loss:
                        - Max trades:

                        ## Invalidation
                        - 

                        ## Journaling prompts
                        - 
                        """)
                .build());
        defaults.add(NotebookTemplate.builder()
                .user(user)
                .name("Monthly Goals")
                .appliesToType(NotebookNoteType.GOAL)
                .content("""
                        ## Goals
                        - 

                        ## Habits to reinforce
                        - 

                        ## Review
                        - Wins:
                        - Gaps:
                        """)
                .build());
        templateRepository.saveAll(defaults);
    }
}
