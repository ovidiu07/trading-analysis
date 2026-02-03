package com.tradevault.repository;

import com.tradevault.domain.entity.UserToken;
import com.tradevault.domain.enums.TokenType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserTokenRepository extends JpaRepository<UserToken, UUID> {
    Optional<UserToken> findByUserIdAndTypeAndTokenHashAndUsedAtIsNull(UUID userId, TokenType type, String tokenHash);

    Optional<UserToken> findFirstByUserIdAndTypeAndUsedAtIsNullOrderByCreatedAtDesc(UUID userId, TokenType type);

    List<UserToken> findAllByUserIdAndTypeAndUsedAtIsNull(UUID userId, TokenType type);
}
