package com.tradevault.dto.notification;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class NotificationFeedResponse {
    List<UserNotificationResponse> items;
    String nextCursor;
}
