package com.tradevault.service.notification;

import com.tradevault.repository.NotificationEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatchService {
    private final NotificationEventRepository notificationEventRepository;
    private final NotificationDispatchWorker notificationDispatchWorker;

    public void dispatchAfterCommit(UUID eventId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    notificationDispatchWorker.dispatchEventAsync(eventId);
                }
            });
            return;
        }
        notificationDispatchWorker.dispatchEventAsync(eventId);
    }

    public void dispatchPendingEvents(int batchSize) {
        int safeBatchSize = Math.max(1, batchSize);
        OffsetDateTime now = OffsetDateTime.now();
        List<UUID> dueEventIds = notificationEventRepository.findDueEventIds(now, PageRequest.of(0, safeBatchSize));
        if (dueEventIds.isEmpty()) {
            return;
        }
        log.debug("Submitting {} due notification events for async dispatch", dueEventIds.size());
        dueEventIds.forEach(notificationDispatchWorker::dispatchEventAsync);
    }
}
