package com.tradevault.repository;

import com.tradevault.domain.entity.UserToken;
import com.tradevault.domain.enums.TokenType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserTokenRepository extends JpaRepository<UserToken, UUID> {
    Optional<UserToken> findByUserIdAndTypeAndTokenHashAndUsedAtIsNull(UUID userId, TokenType type, String tokenHash);

    Optional<UserToken> findByTypeAndTokenHashAndUsedAtIsNull(TokenType type, String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ut from UserToken ut where ut.type = :type and ut.tokenHash = :tokenHash")
    Optional<UserToken> findByTypeAndTokenHashForUpdate(@Param("type") TokenType type,
                                                        @Param("tokenHash") String tokenHash);

    Optional<UserToken> findFirstByUserIdAndTypeAndUsedAtIsNullOrderByCreatedAtDesc(UUID userId, TokenType type);

    List<UserToken> findAllByUserIdAndTypeAndUsedAtIsNull(UUID userId, TokenType type);

    List<UserToken> findAllByUserIdAndTypeOrderByCreatedAtAsc(UUID userId, TokenType type);

    long countByUserIdAndTypeAndUsedAtIsNull(UUID userId, TokenType type);

    @Modifying(flushAutomatically = true)
    @Query("""
            update UserToken ut
            set ut.usedAt = :usedAt
            where ut.user.id = :userId
              and ut.type = :type
              and ut.usedAt is null
            """)
    int revokeActiveTokens(@Param("userId") UUID userId,
                           @Param("type") TokenType type,
                           @Param("usedAt") OffsetDateTime usedAt);
}
