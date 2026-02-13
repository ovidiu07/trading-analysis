package com.tradevault.dto.notification;

import com.tradevault.domain.enums.NotificationMatchPolicy;
import com.tradevault.domain.enums.NotificationPreferenceMode;
import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class NotificationPreferencesResponse {
    boolean enabled;
    boolean notifyOnNew;
    boolean notifyOnUpdates;
    NotificationPreferenceMode mode;
    List<UUID> categories;
    List<String> tags;
    List<String> symbols;
    NotificationMatchPolicy matchPolicy;
}
