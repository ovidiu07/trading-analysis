package com.tradevault.service;

import com.tradevault.domain.entity.Tag;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.Role;
import com.tradevault.domain.enums.TagType;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.TradeResponse;
import com.tradevault.repository.TagRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.when;

@SpringBootTest
@Testcontainers
class TradeServiceListAllIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("tradevault")
            .withUsername("tradevault")
            .withPassword("tradevault");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private TradeService tradeService;

    @Autowired
    private TradeRepository tradeRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private CurrentUserService currentUserService;

    @AfterEach
    void cleanUp() {
        tradeRepository.deleteAll();
        tagRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void listAllLoadsLazyTagsWithoutSessionAndKeepsPaginationMetadata() {
        User user = userRepository.save(User.builder()
                .email("trade-list-tags@example.com")
                .passwordHash("hashed")
                .role(Role.USER)
                .build());
        when(currentUserService.getCurrentUser()).thenReturn(user);

        Tag tagOne = tagRepository.save(Tag.builder()
                .user(user)
                .name("Breakout")
                .type(TagType.STRATEGY)
                .build());
        Tag tagTwo = tagRepository.save(Tag.builder()
                .user(user)
                .name("Momentum")
                .type(TagType.STRATEGY)
                .build());

        tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("AAPL")
                .market(Market.STOCK)
                .direction(Direction.LONG)
                .status(TradeStatus.CLOSED)
                .openedAt(OffsetDateTime.parse("2026-02-10T10:00:00Z"))
                .closedAt(OffsetDateTime.parse("2026-02-10T11:00:00Z"))
                .quantity(new BigDecimal("1"))
                .entryPrice(new BigDecimal("100"))
                .exitPrice(new BigDecimal("110"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .createdAt(OffsetDateTime.parse("2026-02-10T10:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-02-10T11:00:00Z"))
                .tags(Set.of(tagOne, tagTwo))
                .build());

        tradeRepository.save(Trade.builder()
                .user(user)
                .symbol("MSFT")
                .market(Market.STOCK)
                .direction(Direction.SHORT)
                .status(TradeStatus.OPEN)
                .openedAt(OffsetDateTime.parse("2026-02-09T10:00:00Z"))
                .quantity(new BigDecimal("2"))
                .entryPrice(new BigDecimal("200"))
                .fees(BigDecimal.ZERO)
                .commission(BigDecimal.ZERO)
                .slippage(BigDecimal.ZERO)
                .createdAt(OffsetDateTime.parse("2026-02-09T10:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-02-09T10:00:00Z"))
                .build());

        assertThatCode(() -> tradeService.listAll(0, 1)).doesNotThrowAnyException();

        Page<TradeResponse> page = tradeService.listAll(0, 1);
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getSymbol()).isEqualTo("AAPL");
        assertThat(page.getContent().get(0).getTags()).containsExactlyInAnyOrder("Breakout", "Momentum");
    }
}
