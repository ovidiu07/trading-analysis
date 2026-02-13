package com.tradevault.dto.follow;

import com.tradevault.domain.enums.FollowType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FollowRequest {
    @NotNull
    private FollowType followType;

    @NotBlank
    private String value;
}
