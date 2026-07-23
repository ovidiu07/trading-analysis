package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TradeRepositoryCustom {

  default Page<UUID> searchTradeIds(UUID userId,
      OffsetDateTime openedAtFrom, OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom, OffsetDateTime closedAtTo,
      String symbol, String strategy, String brokerAccountId, UUID accountRefId,
      Direction direction, TradeStatus status, Pageable pageable) {
    return searchTradeIds(userId, openedAtFrom, openedAtTo, closedAtFrom, closedAtTo, symbol,
        strategy, brokerAccountId, accountRefId, false, direction, status, pageable);
  }

  Page<UUID> searchTradeIds(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      String brokerAccountId,
      UUID accountRefId,
      boolean unassigned,
      Direction direction,
      TradeStatus status,
      Pageable pageable);

  Page<UUID> searchTradeIdsByAccountScope(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      Collection<UUID> accountRefIds,
      Direction direction,
      TradeStatus status,
      Pageable pageable);

  @Deprecated(forRemoval = false)
  default Page<Trade> search(UUID userId,
      OffsetDateTime openedAtFrom, OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom, OffsetDateTime closedAtTo,
      String symbol, String strategy, String brokerAccountId, UUID accountRefId,
      Direction direction, TradeStatus status, Pageable pageable) {
    return search(userId, openedAtFrom, openedAtTo, closedAtFrom, closedAtTo, symbol,
        strategy, brokerAccountId, accountRefId, false, direction, status, pageable);
  }

  @Deprecated(forRemoval = false)
  Page<Trade> search(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      String brokerAccountId,
      UUID accountRefId,
      boolean unassigned,
      Direction direction,
      TradeStatus status,
      Pageable pageable);
}
