package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TradeRepositoryCustom {

  Page<UUID> searchTradeIds(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      Direction direction,
      TradeStatus status,
      Pageable pageable);

  @Deprecated(forRemoval = false)
  Page<Trade> search(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      Direction direction,
      TradeStatus status,
      Pageable pageable);
}
