package com.tradevault.repository;

import com.tradevault.domain.entity.ContentPost;
import com.tradevault.domain.entity.ContentPostTranslation;
import com.tradevault.domain.enums.ContentPostStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
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
public class ContentPostRepositoryImpl implements ContentPostRepositoryCustom {

  @PersistenceContext
  private EntityManager entityManager;

  @Override
  public Page<ContentPost> searchAdmin(UUID contentTypeId,
      ContentPostStatus status,
      String query,
      String locale,
      String fallbackLocale,
      Pageable pageable) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();

    CriteriaQuery<ContentPost> dataQuery = cb.createQuery(ContentPost.class);
    Root<ContentPost> dataRoot = dataQuery.from(ContentPost.class);
    List<Predicate> predicates = buildAdminPredicates(cb, dataQuery, dataRoot, contentTypeId, status,
        query, locale, fallbackLocale);
    dataQuery.select(dataRoot);
    dataQuery.where(predicates.toArray(Predicate[]::new));
    applySort(cb, dataRoot, dataQuery, pageable.getSort());

    TypedQuery<ContentPost> typedQuery = entityManager.createQuery(dataQuery);
    typedQuery.setFirstResult((int) pageable.getOffset());
    typedQuery.setMaxResults(pageable.getPageSize());
    List<ContentPost> content = typedQuery.getResultList();

    CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
    Root<ContentPost> countRoot = countQuery.from(ContentPost.class);
    List<Predicate> countPredicates = buildAdminPredicates(cb, countQuery, countRoot, contentTypeId,
        status, query, locale, fallbackLocale);
    countQuery.select(cb.count(countRoot));
    countQuery.where(countPredicates.toArray(Predicate[]::new));
    long total = entityManager.createQuery(countQuery).getSingleResult();

    return new PageImpl<>(content, pageable, total);
  }

  @Override
  public List<ContentPost> searchPublished(ContentPostStatus status,
      String contentTypeKey,
      String query,
      String locale,
      String fallbackLocale,
      boolean activeOnly,
      OffsetDateTime now) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();
    CriteriaQuery<ContentPost> criteriaQuery = cb.createQuery(ContentPost.class);
    Root<ContentPost> root = criteriaQuery.from(ContentPost.class);

    List<Predicate> predicates = new ArrayList<>();
    predicates.add(cb.equal(root.get("status"), status));
    if (contentTypeKey != null) {
      predicates.add(cb.equal(root.get("contentType").get("key"), contentTypeKey));
    }
    addTranslationQueryPredicate(cb, criteriaQuery, root, predicates, query, locale, fallbackLocale);
    if (activeOnly) {
      predicates.add(cb.or(cb.isNull(root.get("visibleFrom")),
          cb.lessThanOrEqualTo(root.get("visibleFrom"), now)));
      predicates.add(cb.or(cb.isNull(root.get("visibleUntil")),
          cb.greaterThanOrEqualTo(root.get("visibleUntil"), now)));
    }

    criteriaQuery.select(root);
    criteriaQuery.where(predicates.toArray(Predicate[]::new));
    criteriaQuery.orderBy(cb.desc(root.get("publishedAt")), cb.desc(root.get("updatedAt")));

    return entityManager.createQuery(criteriaQuery).getResultList();
  }

  private List<Predicate> buildAdminPredicates(CriteriaBuilder cb,
      CriteriaQuery<?> query,
      Root<ContentPost> root,
      UUID contentTypeId,
      ContentPostStatus status,
      String rawQuery,
      String locale,
      String fallbackLocale) {
    List<Predicate> predicates = new ArrayList<>();
    if (contentTypeId != null) {
      predicates.add(cb.equal(root.get("contentType").get("id"), contentTypeId));
    }
    if (status != null) {
      predicates.add(cb.equal(root.get("status"), status));
    }
    addTranslationQueryPredicate(cb, query, root, predicates, rawQuery, locale, fallbackLocale);
    return predicates;
  }

  private void addTranslationQueryPredicate(CriteriaBuilder cb,
      CriteriaQuery<?> query,
      Root<ContentPost> root,
      List<Predicate> predicates,
      String rawQuery,
      String locale,
      String fallbackLocale) {
    if (rawQuery == null || rawQuery.isEmpty()) {
      return;
    }

    String likePattern = "%" + rawQuery.toLowerCase(Locale.ROOT) + "%";
    Subquery<Integer> subquery = query.subquery(Integer.class);
    Root<ContentPostTranslation> translation = subquery.from(ContentPostTranslation.class);

    List<Predicate> subqueryPredicates = new ArrayList<>();
    subqueryPredicates.add(cb.equal(translation.get("contentPost"), root));

    if (locale == null && fallbackLocale == null) {
      subqueryPredicates.add(cb.disjunction());
    } else {
      jakarta.persistence.criteria.CriteriaBuilder.In<String> localeIn = cb.in(translation.get("locale"));
      if (locale != null) {
        localeIn.value(locale);
      }
      if (fallbackLocale != null) {
        localeIn.value(fallbackLocale);
      }
      subqueryPredicates.add(localeIn);
    }

    Expression<String> safeSummary = cb.coalesce(translation.get("summary"), "");
    subqueryPredicates.add(cb.or(
        cb.like(cb.lower(translation.get("title")), likePattern),
        cb.like(cb.lower(safeSummary), likePattern),
        cb.like(cb.lower(translation.get("bodyMarkdown")), likePattern)
    ));

    subquery.select(cb.literal(1));
    subquery.where(subqueryPredicates.toArray(Predicate[]::new));
    predicates.add(cb.exists(subquery));
  }

  private void applySort(CriteriaBuilder cb, Root<ContentPost> root, CriteriaQuery<?> query, Sort sort) {
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
