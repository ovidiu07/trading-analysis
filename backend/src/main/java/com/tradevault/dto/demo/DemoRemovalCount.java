package com.tradevault.dto.demo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DemoRemovalCount {
    private long trades;
    private long notes;
    private long notebookTags;
    private long notebookTagLinks;
    private long notebookAttachments;
    private long tags;
    private long accounts;
    private long notebookTemplates;
    private long notebookFolders;
}
