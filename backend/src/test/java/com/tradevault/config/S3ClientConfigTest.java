package com.tradevault.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import software.amazon.awssdk.services.s3.S3Client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class S3ClientConfigTest {

    @Test
    void resolveSettingsUsesStaticCredentialsAndConfiguredRegion() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion("eu-central-1");
        properties.setAccessKey("test-access");
        properties.setSecretKey("test-secret");

        S3ClientConfig config = new S3ClientConfig(new MockEnvironment());
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        assertEquals("assets", settings.bucket());
        assertEquals("eu-central-1", settings.region().id());
        assertEquals("static", settings.credentialSource());
    }

    @Test
    void resolveSettingsFallsBackToAwsEnvironmentVariables() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion(null);
        properties.setAccessKey(null);
        properties.setSecretKey(null);

        MockEnvironment env = new MockEnvironment()
                .withProperty("AWS_REGION", "us-east-2")
                .withProperty("AWS_ACCESS_KEY_ID", "aws-access")
                .withProperty("AWS_SECRET_ACCESS_KEY", "aws-secret");

        S3ClientConfig config = new S3ClientConfig(env);
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        assertEquals("us-east-2", settings.region().id());
        assertEquals("static", settings.credentialSource());
    }

    @Test
    void resolveSettingsFallsBackToAwsDefaultRegionAndEndpointAliases() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion(null);
        properties.setAccessKey(null);
        properties.setSecretKey(null);

        MockEnvironment env = new MockEnvironment()
                .withProperty("AWS_DEFAULT_REGION", "us-west-2")
                .withProperty("AWS_ENDPOINT_URL_S3", "https://storage.example.com/")
                .withProperty("AWS_ACCESS_KEY_ID", "aws-access")
                .withProperty("AWS_SECRET_ACCESS_KEY", "aws-secret");

        S3ClientConfig config = new S3ClientConfig(env);
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        assertEquals("us-west-2", settings.region().id());
        assertEquals("https://storage.example.com", settings.endpoint().toString());
        assertEquals("static", settings.credentialSource());
    }

    @Test
    void resolveSettingsUsesDefaultChainWhenIamRoleEnabled() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion("us-east-1");
        properties.setUseIamRole(true);

        S3ClientConfig config = new S3ClientConfig(new MockEnvironment());
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        assertEquals("defaultChain", settings.credentialSource());
    }

    @Test
    void resolveSettingsTurnsOnPathStyleAccessAndDisablesCrossRegionForCustomEndpoint() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion("us-east-1");
        properties.setAccessKey("test-access");
        properties.setSecretKey("test-secret");

        MockEnvironment env = new MockEnvironment()
                .withProperty("STORAGE_S3_ENDPOINT", "https://storage.example.com")
                .withProperty("STORAGE_S3_PATH_STYLE_ACCESS", "true");

        S3ClientConfig config = new S3ClientConfig(env);
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        assertTrue(settings.pathStyleAccess());
        assertFalse(settings.crossRegionAccessEnabled());
    }

    @Test
    void resolveSettingsSupportsLegacyForcePathStyleAlias() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion("us-east-1");
        properties.setAccessKey("test-access");
        properties.setSecretKey("test-secret");

        MockEnvironment env = new MockEnvironment()
                .withProperty("STORAGE_S3_FORCE_PATH_STYLE", "true");

        S3ClientConfig config = new S3ClientConfig(env);
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        assertTrue(settings.pathStyleAccess());
    }

    @Test
    void s3ClientBuildsWhenPathStyleAccessIsEnabled() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion("us-east-1");
        properties.setAccessKey("test-access");
        properties.setSecretKey("test-secret");
        properties.setPathStyleAccess(true);

        MockEnvironment env = new MockEnvironment()
                .withProperty("STORAGE_S3_ENDPOINT", "https://storage.example.com");

        S3ClientConfig config = new S3ClientConfig(env);
        S3ClientConfig.S3ResolvedSettings settings = config.resolveSettings(properties);

        try (S3Client client = config.s3Client(settings)) {
            assertNotNull(client);
        }
    }

    @Test
    void resolveSettingsFailsWhenRegionMissing() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion(null);
        properties.setAccessKey("test-access");
        properties.setSecretKey("test-secret");

        S3ClientConfig config = new S3ClientConfig(new MockEnvironment());

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.resolveSettings(properties));
        assertTrue(ex.getMessage().contains("S3 region is not configured"));
    }

    @Test
    void resolveSettingsFailsWhenCredentialsMissingAndIamRoleDisabled() {
        StorageS3Properties properties = new StorageS3Properties();
        properties.setBucket("assets");
        properties.setRegion("us-east-1");
        properties.setAccessKey(null);
        properties.setSecretKey(null);
        properties.setUseIamRole(false);

        S3ClientConfig config = new S3ClientConfig(new MockEnvironment());

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.resolveSettings(properties));
        assertTrue(ex.getMessage().contains("S3 credentials are not configured"));
    }
}
