package com.tradevault.domain.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class MonthlyGrowthPlanRevisionMappingTest {

    @Test
    void targetRevisionFieldsUseTheFlywayColumnNames() throws NoSuchFieldException {
        Map<String, String> expectedColumns = Map.of(
                "previousTargetType", "previous_target_type",
                "previousTargetPct", "previous_target_pct",
                "previousTargetAmount", "previous_target_amount",
                "previousTargetR", "previous_target_r",
                "newTargetType", "new_target_type",
                "newTargetPct", "new_target_pct",
                "newTargetAmount", "new_target_amount",
                "newTargetR", "new_target_r"
        );

        for (Map.Entry<String, String> expected : expectedColumns.entrySet()) {
            Column column = MonthlyGrowthPlanRevision.class
                    .getDeclaredField(expected.getKey())
                    .getAnnotation(Column.class);

            assertNotNull(column, () -> expected.getKey() + " must have an explicit column mapping");
            assertEquals(expected.getValue(), column.name());
        }
    }
}
