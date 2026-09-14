package com.tradevault.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class SessionSetupAccountMappingTest {

    @Test
    void entityFieldsMatchTheAccountScopedSetupMigration() throws Exception {
        JoinColumn account = SessionSetup.class.getDeclaredField("account").getAnnotation(JoinColumn.class);
        Column sourceDraft = SessionSetup.class.getDeclaredField("sourceDraftId").getAnnotation(Column.class);

        assertThat(account).isNotNull();
        assertThat(account.name()).isEqualTo("account_id");
        assertThat(sourceDraft).isNotNull();
        assertThat(sourceDraft.name()).isEqualTo("source_draft_id");
        assertThat(sourceDraft.length()).isEqualTo(120);
    }

    @Test
    void migrationPreservesLegacyRowsAndEnforcesOwnedIdempotentDrafts() {
        assertThatCode(() -> {
            try (InputStream stream = getClass().getResourceAsStream("/db/migration/V68__account_scoped_session_setups.sql")) {
                assertThat(stream).isNotNull();
                String migration = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
                assertThat(migration)
                        .contains("ADD COLUMN IF NOT EXISTS account_id UUID")
                        .contains("FOREIGN KEY (account_id, user_id)")
                        .contains("REFERENCES accounts (id, user_id)")
                        .contains("CREATE UNIQUE INDEX IF NOT EXISTS ux_session_setups_user_source_draft")
                        .contains("WHERE source_draft_id IS NOT NULL")
                        .doesNotContain("account_id UUID NOT NULL");
            }
        }).doesNotThrowAnyException();
    }
}
