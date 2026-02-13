package com.tradevault.repository;

import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.NotebookTagLink;
import com.tradevault.domain.enums.NotebookNoteType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
public class NotebookNoteRepositoryImpl implements NotebookNoteRepositoryCustom {

  @PersistenceContext
  private EntityManager entityManager;

  @Override
  public List<NotebookNote> searchNotes(UUID userId,
      NotebookNoteType type,
      UUID folderId,
      LocalDate fromDate,
      LocalDate toDate,
      Boolean isDeleted,
      String query,
      Sort sort) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();
    CriteriaQuery<NotebookNote> criteriaQuery = cb.createQuery(NotebookNote.class);
    Root<NotebookNote> root = criteriaQuery.from(NotebookNote.class);

    List<Predicate> predicates = buildPredicates(cb, root, userId, type, folderId, fromDate,
        toDate, isDeleted, query);
    criteriaQuery.select(root);
    criteriaQuery.where(predicates.toArray(Predicate[]::new));
    applySort(cb, root, criteriaQuery, sort);

    return entityManager.createQuery(criteriaQuery).getResultList();
  }

  @Override
  public List<NotebookNote> searchNotesByTags(UUID userId,
      NotebookNoteType type,
      UUID folderId,
      LocalDate fromDate,
      LocalDate toDate,
      Boolean isDeleted,
      String query,
      List<UUID> tagIds,
      Sort sort) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();
    CriteriaQuery<NotebookNote> criteriaQuery = cb.createQuery(NotebookNote.class);
    Root<NotebookNote> root = criteriaQuery.from(NotebookNote.class);

    List<Predicate> predicates = buildPredicates(cb, root, userId, type, folderId, fromDate,
        toDate, isDeleted, query);
    if (tagIds != null && !tagIds.isEmpty()) {
      Subquery<Integer> tagSubquery = criteriaQuery.subquery(Integer.class);
      Root<NotebookTagLink> link = tagSubquery.from(NotebookTagLink.class);
      tagSubquery.select(cb.literal(1));
      tagSubquery.where(
          cb.equal(link.get("note").get("id"), root.get("id")),
          link.get("tag").get("id").in(tagIds)
      );
      predicates.add(cb.exists(tagSubquery));
    }

    criteriaQuery.select(root);
    criteriaQuery.where(predicates.toArray(Predicate[]::new));
    applySort(cb, root, criteriaQuery, sort);

    return entityManager.createQuery(criteriaQuery).getResultList();
  }

  private List<Predicate> buildPredicates(CriteriaBuilder cb,
      Root<NotebookNote> root,
      UUID userId,
      NotebookNoteType type,
      UUID folderId,
      LocalDate fromDate,
      LocalDate toDate,
      Boolean isDeleted,
      String query) {
    List<Predicate> predicates = new ArrayList<>();
    predicates.add(cb.equal(root.get("user").get("id"), userId));

    if (type != null) {
      predicates.add(cb.equal(root.get("type"), type));
    }
    if (folderId != null) {
      predicates.add(cb.equal(root.get("folder").get("id"), folderId));
    }
    if (fromDate != null) {
      predicates.add(cb.greaterThanOrEqualTo(root.get("dateKey"), fromDate));
    }
    if (toDate != null) {
      predicates.add(cb.lessThanOrEqualTo(root.get("dateKey"), toDate));
    }
    if (isDeleted != null) {
      predicates.add(cb.equal(root.get("isDeleted"), isDeleted));
    }
    if (query != null && !query.isEmpty()) {
      String likePattern = "%" + query.toLowerCase(Locale.ROOT) + "%";
      Expression<String> safeTitle = cb.coalesce(root.get("title"), "");
      Expression<String> safeBody = cb.coalesce(root.get("body"), "");
      predicates.add(cb.or(
          cb.like(cb.lower(safeTitle), likePattern),
          cb.like(cb.lower(safeBody), likePattern)
      ));
    }

    return predicates;
  }

  private void applySort(CriteriaBuilder cb, Root<NotebookNote> root, CriteriaQuery<?> query, Sort sort) {
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
