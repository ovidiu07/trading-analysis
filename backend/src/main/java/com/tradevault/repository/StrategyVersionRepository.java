package com.tradevault.repository;

import com.tradevault.domain.entity.StrategyVersion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StrategyVersionRepository extends JpaRepository<StrategyVersion, UUID> {
    interface Summary {
        UUID getId();

        Integer getVersionNumber();

        String getName();

        String getChangeDescription();

        java.time.OffsetDateTime getCreatedAt();
    }

    @Query(
            "select v.id as id, v.versionNumber as versionNumber, v.name as name,"
                + " v.changeDescription as changeDescription, v.createdAt as createdAt from"
                + " StrategyVersion v where v.strategy.id = :strategyId and v.user.id = :userId"
                + " order by v.versionNumber desc")
    List<Summary> findSummaries(UUID strategyId, UUID userId);

    // A draft may have diverged since the last checkpoint. Never associate an
    // execution with a checkpoint that describes a different configuration.
    @Query(
            value =
                    """
                    select v.* from tradevault.strategy_versions v
                    join tradevault.user_strategies s on s.id = v.strategy_id
                    where s.id = :strategyId and s.user_id = :userId
                      and v.snapshot_json @> jsonb_build_object(
                        'name', s.name, 'model', s.model,
                        'entryConditionsRich', s.entry_conditions_rich,
                        'invalidationLogic', s.invalidation_logic, 'tpFramework', s.tp_framework,
                        'noTradeRules', s.no_trade_rules,
                        'sessionSuitabilityJson', s.session_suitability, 'tagsJson', s.tags)
                      and coalesce(v.snapshot_json->'studio', cast('null' as jsonb)) = coalesce(s.studio_json, cast('null' as jsonb))
                      and coalesce(v.snapshot_json->>'snapshotAssetId', '') = coalesce(cast(s.snapshot_asset_id as text), '')
                      and coalesce(cast(v.snapshot_json->>'archived' as boolean), false) = s.archived
                    order by v.version_number desc limit 1
                    """,
            nativeQuery = true)
    Optional<StrategyVersion> findMatchingCurrentCheckpoint(UUID strategyId, UUID userId);

    Optional<StrategyVersion> findFirstByStrategy_IdOrderByVersionNumberDesc(UUID strategyId);

    List<StrategyVersion> findByStrategy_IdAndUser_IdOrderByVersionNumberDesc(
            UUID strategyId, UUID userId);

    Optional<StrategyVersion> findByIdAndUser_Id(UUID id, UUID userId);
}
