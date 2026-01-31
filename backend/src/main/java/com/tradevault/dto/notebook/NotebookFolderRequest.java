package com.tradevault.dto.notebook;

import lombok.Data;

import java.util.UUID;

@Data
public class NotebookFolderRequest {
    private String name;
    private UUID parentId;
    private Integer sortOrder;
}
