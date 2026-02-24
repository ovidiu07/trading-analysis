package com.tradevault.service;

import com.tradevault.domain.enums.BacktestCandleSource;
import com.tradevault.dto.session.LiveQuoteResponse;
import com.tradevault.dto.session.QuoteAvailabilityReason;
import com.tradevault.repository.BacktestProviderCredentialRepository;
import com.tradevault.service.backtest.BacktestProviderService;
import com.tradevault.service.backtest.BacktestTokenCipherService;
import com.tradevault.service.backtest.OandaCandleProvider;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringJUnitConfig(QuoteServiceTransactionBoundaryTest.Config.class)
class QuoteServiceTransactionBoundaryTest {

    @Configuration
    @EnableTransactionManagement
    static class Config {
        @Bean
        PlatformTransactionManager platformTransactionManager() {
            return new InMemoryTransactionManager();
        }

        @Bean
        CurrentUserService currentUserService() {
            return mock(CurrentUserService.class);
        }

        @Bean
        BacktestProviderCredentialRepository backtestProviderCredentialRepository() {
            return mock(BacktestProviderCredentialRepository.class);
        }

        @Bean
        BacktestTokenCipherService backtestTokenCipherService() {
            return mock(BacktestTokenCipherService.class);
        }

        @Bean
        OandaCandleProvider oandaCandleProvider() {
            return mock(OandaCandleProvider.class);
        }

        @Bean
        BacktestProviderService backtestProviderService(BacktestProviderCredentialRepository credentialRepository,
                                                        BacktestTokenCipherService tokenCipherService,
                                                        OandaCandleProvider oandaCandleProvider) {
            return new BacktestProviderService(credentialRepository, tokenCipherService, oandaCandleProvider);
        }

        @Bean
        QuoteService quoteService(CurrentUserService currentUserService,
                                  BacktestProviderService backtestProviderService,
                                  OandaCandleProvider oandaCandleProvider) {
            return new QuoteService(currentUserService, backtestProviderService, oandaCandleProvider);
        }
    }

    static class InMemoryTransactionManager extends AbstractPlatformTransactionManager {
        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
            // No-op: this in-memory manager exists only for transaction propagation tests.
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
            // No-op
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
            // No-op
        }
    }

    @jakarta.annotation.Resource
    private QuoteService quoteService;

    @jakarta.annotation.Resource
    private PlatformTransactionManager platformTransactionManager;

    @jakarta.annotation.Resource
    private BacktestProviderCredentialRepository credentialRepository;

    @Test
    void unavailableQuoteDoesNotMarkCallerTransactionRollbackOnly() {
        UUID userId = UUID.randomUUID();
        when(credentialRepository.findByUser_IdAndProvider(userId, BacktestCandleSource.OANDA))
                .thenReturn(Optional.empty());

        TransactionTemplate transactionTemplate = new TransactionTemplate(platformTransactionManager);

        assertDoesNotThrow(() -> transactionTemplate.executeWithoutResult(status -> {
            LiveQuoteResponse response = quoteService.getLiveQuoteForUser(userId, "OANDA:EURUSD");
            assertFalse(response.isAvailable());
            assertEquals(QuoteAvailabilityReason.NO_CREDENTIALS, response.getReason());
        }));
    }
}
