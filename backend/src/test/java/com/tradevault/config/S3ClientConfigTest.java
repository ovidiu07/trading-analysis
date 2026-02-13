package com.tradevault.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
