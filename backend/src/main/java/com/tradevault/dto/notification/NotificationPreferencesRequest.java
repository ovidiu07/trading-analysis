package com.tradevault.dto.notification;

import com.tradevault.domain.enums.NotificationMatchPolicy;
import com.tradevault.domain.enums.NotificationPreferenceMode;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class NotificationPreferencesRequest {
    private boolean enabled = true;
    private boolean notifyOnNew = true;
    private boolean notifyOnUpdates = true;

    @NotNull
    private NotificationPreferenceMode mode;

    private List<UUID> categories;
    private List<String> tags;
    private List<String> symbols;
    private NotificationMatchPolicy matchPolicy;
}
