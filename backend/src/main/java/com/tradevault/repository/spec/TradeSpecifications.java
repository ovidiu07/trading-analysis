package com.tradevault.repository.spec;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class TradeSpecifications {
  private TradeSpecifications() {
  }

  public static Specification<Trade> userId(UUID userId) {
    return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
  }

  public static Specification<Trade> openedAtFrom(OffsetDateTime from) {
    return from == null ? null : (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("openedAt"), from);
  }

  public static Specification<Trade> openedAtTo(OffsetDateTime to) {
    return to == null ? null : (root, query, cb) -> cb.lessThanOrEqualTo(root.get("openedAt"), to);
  }

  public static Specification<Trade> closedAtFrom(OffsetDateTime from) {
    return from == null ? null : (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("closedAt"), from);
  }

  public static Specification<Trade> closedAtTo(OffsetDateTime to) {
    return to == null ? null : (root, query, cb) -> cb.lessThanOrEqualTo(root.get("closedAt"), to);
  }

  public static Specification<Trade> symbolEqualsIgnoreCase(String symbolLower) {
    return symbolLower == null ? null : (root, query, cb) -> cb.equal(cb.lower(root.get("symbol")), symbolLower);
  }

  public static Specification<Trade> strategyEqualsIgnoreCase(String strategyLower) {
    return strategyLower == null ? null : (root, query, cb) -> cb.equal(cb.lower(root.get("strategyTag")), strategyLower);
  }

  public static Specification<Trade> direction(Direction direction) {
    return direction == null ? null : (root, query, cb) -> cb.equal(root.get("direction"), direction);
  }

  public static Specification<Trade> status(TradeStatus status) {
    return status == null ? null : (root, query, cb) -> cb.equal(root.get("status"), status);
  }
}
