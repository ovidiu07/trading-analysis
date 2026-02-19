package com.tradevault.service.notification;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Connection;
import java.sql.PreparedStatement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationDispatchLockServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private TransactionTemplate transactionTemplate;

    private NotificationDispatchLockService lockService;

    @BeforeEach
    void setUp() {
        lockService = new NotificationDispatchLockService(jdbcTemplate, transactionTemplate);
        ReflectionTestUtils.setField(lockService, "advisoryLockKey", 42L);
        ReflectionTestUtils.setField(lockService, "lockQueryTimeoutSeconds", 3);
        ReflectionTestUtils.setField(lockService, "lockStatementTimeoutMillis", 3000);

        when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(null);
        });
    }

    @Test
    void tryAcquireDistributedLockAppliesStatementAndQueryTimeouts() throws Exception {
        when(jdbcTemplate.execute(any(PreparedStatementCreator.class), any(PreparedStatementCallback.class)))
                .thenReturn(true);

        boolean acquired = lockService.tryAcquireDistributedLock();

        assertThat(acquired).isTrue();
        verify(jdbcTemplate).execute("SET LOCAL statement_timeout = 3000");

        ArgumentCaptor<PreparedStatementCreator> creatorCaptor = ArgumentCaptor.forClass(PreparedStatementCreator.class);
        verify(jdbcTemplate).execute(creatorCaptor.capture(), any(PreparedStatementCallback.class));

        Connection connection = org.mockito.Mockito.mock(Connection.class);
        PreparedStatement preparedStatement = org.mockito.Mockito.mock(PreparedStatement.class);
        when(connection.prepareStatement(eq("SELECT pg_try_advisory_lock(?)"))).thenReturn(preparedStatement);
        creatorCaptor.getValue().createPreparedStatement(connection);
        verify(preparedStatement).setQueryTimeout(3);
        verify(preparedStatement).setLong(1, 42L);
    }

    @Test
    void releaseDistributedLockReturnsFalseWhenDatabaseDidNotRelease() {
        when(jdbcTemplate.execute(any(PreparedStatementCreator.class), any(PreparedStatementCallback.class)))
                .thenReturn(false);

        boolean released = lockService.releaseDistributedLock();

        assertThat(released).isFalse();
        verify(jdbcTemplate).execute("SET LOCAL statement_timeout = 3000");
    }
}
