package com.tradevault.service.notification;

import com.tradevault.dto.notification.NotificationCreatedStreamPayload;
import com.tradevault.dto.notification.NotificationUnreadCountResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Slf4j
public class NotificationStreamService {
    private static final long EMITTER_TIMEOUT_MS = 0L;

    private final ConcurrentMap<UUID, Set<SseEmitter>> emittersByUser = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID userId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        emittersByUser.computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> {
            removeEmitter(userId, emitter);
            emitter.complete();
        });
        emitter.onError(throwable -> removeEmitter(userId, emitter));

        send(userId, "connected", Map.of("connectedAt", OffsetDateTime.now().toString()));
        return emitter;
    }

    public void sendUnreadCount(UUID userId, long unreadCount) {
        send(userId, "unread_count", new NotificationUnreadCountResponse(unreadCount));
    }

    public void sendNotificationCreated(UUID userId, NotificationCreatedStreamPayload payload) {
        send(userId, "notification_created", payload);
    }

    @Scheduled(fixedDelayString = "${notifications.stream.heartbeat-ms:25000}")
    public void sendHeartbeat() {
        emittersByUser.keySet().forEach(userId ->
                send(userId, "ping", Map.of("at", OffsetDateTime.now().toString())));
    }

    private void send(UUID userId, String eventName, Object payload) {
        Set<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters.toArray(new SseEmitter[0])) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException ex) {
                removeEmitter(userId, emitter);
                try {
                    emitter.completeWithError(ex);
                } catch (Exception ignored) {
                    // no-op
                }
            } catch (Exception ex) {
                removeEmitter(userId, emitter);
                log.debug("Failed to send '{}' notification stream event for user {}", eventName, userId);
            }
        }
    }

    private void removeEmitter(UUID userId, SseEmitter emitter) {
        Set<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByUser.remove(userId, emitters);
        }
    }
}
