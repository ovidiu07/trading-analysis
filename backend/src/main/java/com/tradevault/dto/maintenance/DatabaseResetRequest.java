package com.tradevault.dto.maintenance;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DatabaseResetRequest {
    @NotBlank
    private String confirmation;

    @AssertTrue(message = "preserveUsers must be true")
    private boolean preserveUsers;

    @NotBlank
    private String password;
}
