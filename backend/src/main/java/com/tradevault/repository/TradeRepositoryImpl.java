package com.tradevault.repository;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.TradeStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
public class TradeRepositoryImpl implements TradeRepositoryCustom {

  @PersistenceContext
  private EntityManager entityManager;

  @Override
  public Page<UUID> searchTradeIds(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      Direction direction,
      TradeStatus status,
      Pageable pageable) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();

    CriteriaQuery<UUID> idQuery = cb.createQuery(UUID.class);
    Root<Trade> idRoot = idQuery.from(Trade.class);
    List<Predicate> idPredicates = buildSearchPredicates(cb, idRoot, userId, openedAtFrom, openedAtTo,
        closedAtFrom, closedAtTo, symbol, strategy, direction, status);
    idQuery.select(idRoot.get("id"));
    idQuery.where(idPredicates.toArray(Predicate[]::new));
    applySort(cb, idRoot, idQuery, pageable.getSort());

    TypedQuery<UUID> typedIdQuery = entityManager.createQuery(idQuery);
    typedIdQuery.setFirstResult((int) pageable.getOffset());
    typedIdQuery.setMaxResults(pageable.getPageSize());
    List<UUID> ids = typedIdQuery.getResultList();

    CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
    Root<Trade> countRoot = countQuery.from(Trade.class);
    List<Predicate> countPredicates = buildSearchPredicates(cb, countRoot, userId, openedAtFrom,
        openedAtTo, closedAtFrom, closedAtTo, symbol, strategy, direction, status);
    countQuery.select(cb.count(countRoot));
    countQuery.where(countPredicates.toArray(Predicate[]::new));
    long total = entityManager.createQuery(countQuery).getSingleResult();

    return new PageImpl<>(ids, pageable, total);
  }

  @Override
  public Page<Trade> search(UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      Direction direction,
      TradeStatus status,
      Pageable pageable) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();

    CriteriaQuery<Trade> entityQuery = cb.createQuery(Trade.class);
    Root<Trade> entityRoot = entityQuery.from(Trade.class);
    List<Predicate> entityPredicates = buildSearchPredicates(cb, entityRoot, userId, openedAtFrom,
        openedAtTo, closedAtFrom, closedAtTo, symbol, strategy, direction, status);
    entityQuery.select(entityRoot);
    entityQuery.where(entityPredicates.toArray(Predicate[]::new));
    applySort(cb, entityRoot, entityQuery, pageable.getSort());

    TypedQuery<Trade> typedEntityQuery = entityManager.createQuery(entityQuery);
    typedEntityQuery.setFirstResult((int) pageable.getOffset());
    typedEntityQuery.setMaxResults(pageable.getPageSize());
    List<Trade> content = typedEntityQuery.getResultList();

    CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
    Root<Trade> countRoot = countQuery.from(Trade.class);
    List<Predicate> countPredicates = buildSearchPredicates(cb, countRoot, userId, openedAtFrom,
        openedAtTo, closedAtFrom, closedAtTo, symbol, strategy, direction, status);
    countQuery.select(cb.count(countRoot));
    countQuery.where(countPredicates.toArray(Predicate[]::new));
    long total = entityManager.createQuery(countQuery).getSingleResult();

    return new PageImpl<>(content, pageable, total);
  }

  private List<Predicate> buildSearchPredicates(CriteriaBuilder cb,
      Root<Trade> root,
      UUID userId,
      OffsetDateTime openedAtFrom,
      OffsetDateTime openedAtTo,
      OffsetDateTime closedAtFrom,
      OffsetDateTime closedAtTo,
      String symbol,
      String strategy,
      Direction direction,
      TradeStatus status) {
    List<Predicate> predicates = new ArrayList<>();
    predicates.add(cb.equal(root.get("user").get("id"), userId));

    if (openedAtFrom != null) {
      predicates.add(cb.greaterThanOrEqualTo(root.get("openedAt"), openedAtFrom));
    }
    if (openedAtTo != null) {
      predicates.add(cb.lessThanOrEqualTo(root.get("openedAt"), openedAtTo));
    }
    if (closedAtFrom != null) {
      predicates.add(cb.greaterThanOrEqualTo(root.get("closedAt"), closedAtFrom));
    }
    if (closedAtTo != null) {
      predicates.add(cb.lessThanOrEqualTo(root.get("closedAt"), closedAtTo));
    }

    if (symbol != null) {
      predicates.add(cb.equal(cb.lower(root.get("symbol")), symbol.toLowerCase(Locale.ROOT)));
    }
    if (strategy != null) {
      predicates.add(cb.equal(cb.lower(root.get("strategyTag")),
          strategy.toLowerCase(Locale.ROOT)));
    }
    if (direction != null) {
      predicates.add(cb.equal(root.get("direction"), direction));
    }
    if (status != null) {
      predicates.add(cb.equal(root.get("status"), status));
    }

    return predicates;
  }

  private void applySort(CriteriaBuilder cb, Root<Trade> root, CriteriaQuery<?> query, Sort sort) {
    if (sort == null || sort.isUnsorted()) {
      return;
    }
    List<Order> orders = new ArrayList<>();
    for (Sort.Order order : sort) {
      Path<?> path = resolvePath(root, order.getProperty());
      orders.add(order.isAscending() ? cb.asc(path) : cb.desc(path));
    }
    query.orderBy(orders);
  }

  private Path<?> resolvePath(Path<?> root, String property) {
    Path<?> path = root;
    for (String part : property.split("\\.")) {
      path = path.get(part);
    }
    return path;
  }
}
