package com.tradevault.dto.notebook;

import com.tradevault.domain.enums.NotebookNoteType;
import lombok.Data;

@Data
public class NotebookTemplateRequest {
    private String name;
    private NotebookNoteType appliesToType;
    private String content;
}
