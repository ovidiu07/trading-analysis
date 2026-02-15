package com.tradevault.repository;

import jakarta.persistence.Entity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.core.type.filter.RegexPatternTypeFilter;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class NamedEnumJpqlLiteralGuardTest {

    private static final String ENTITY_PACKAGE = "com.tradevault.domain.entity";
    private static final String REPOSITORY_PACKAGE = "com.tradevault.repository";
    private static final Pattern ENUM_LITERAL_PATTERN =
            Pattern.compile("com\\.tradevault\\.domain\\.enums\\.([A-Za-z0-9_]+)\\.[A-Z0-9_]+");

    @Test
    void jpqlQueriesDoNotInlineLiteralsForNamedEnums() throws ClassNotFoundException {
        Set<String> namedEnumSimpleNames = namedEnumSimpleNames();
        Set<String> violations = new TreeSet<>();

        for (Class<?> repositoryClass : repositoryInterfaces()) {
            for (Method method : repositoryClass.getDeclaredMethods()) {
                Query query = method.getAnnotation(Query.class);
                if (query == null || query.nativeQuery()) {
                    continue;
                }
                Matcher matcher = ENUM_LITERAL_PATTERN.matcher(query.value());
                while (matcher.find()) {
                    String enumSimpleName = matcher.group(1);
                    if (namedEnumSimpleNames.contains(enumSimpleName)) {
                        violations.add(repositoryClass.getSimpleName() + "." + method.getName() + " -> " + matcher.group());
                    }
                }
            }
        }

        assertThat(violations)
                .as("JPQL enum literals for NAMED_ENUM fields cause hard-coded PostgreSQL casts; pass enums as query parameters instead.")
                .isEmpty();
    }

    private Set<String> namedEnumSimpleNames() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

        Set<String> enumNames = new TreeSet<>();
        for (BeanDefinition component : scanner.findCandidateComponents(ENTITY_PACKAGE)) {
            Class<?> entityClass = Class.forName(component.getBeanClassName());
            for (Field field : entityClass.getDeclaredFields()) {
                JdbcTypeCode jdbcTypeCode = field.getAnnotation(JdbcTypeCode.class);
                if (jdbcTypeCode != null && jdbcTypeCode.value() == SqlTypes.NAMED_ENUM && field.getType().isEnum()) {
                    enumNames.add(field.getType().getSimpleName());
                }
            }
        }
        return enumNames;
    }

    private Set<Class<?>> repositoryInterfaces() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new RegexPatternTypeFilter(Pattern.compile("com\\.tradevault\\.repository\\..*Repository")));

        Set<Class<?>> repositories = new TreeSet<>((left, right) -> left.getName().compareTo(right.getName()));
        for (BeanDefinition component : scanner.findCandidateComponents(REPOSITORY_PACKAGE)) {
            Class<?> repositoryClass = Class.forName(component.getBeanClassName());
            if (repositoryClass.isInterface()) {
                repositories.add(repositoryClass);
            }
        }
        return repositories;
    }
}
