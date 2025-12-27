package com.tradevault.dto.tag;

import com.tradevault.domain.enums.TagType;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class TagResponse {
    private UUID id;
    private String name;
    private TagType type;
}
