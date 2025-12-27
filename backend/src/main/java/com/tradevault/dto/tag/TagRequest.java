package com.tradevault.dto.tag;

import com.tradevault.domain.enums.TagType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TagRequest {
    @NotBlank
    private String name;
    @NotNull
    private TagType type;
}
