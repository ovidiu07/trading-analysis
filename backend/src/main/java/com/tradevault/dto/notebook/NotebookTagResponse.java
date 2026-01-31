package com.tradevault.dto.notebook;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class NotebookTagResponse {
    UUID id;
    String name;
    String color;
}
