package com.tradevault.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.SystemEnvironmentPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StorageS3PropertiesBindingTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(BindingTestConfig.class);

    @Test
    void bindsFromSystemStyleEnvironmentVariables() {
        contextRunner
                .withInitializer(context -> context.getEnvironment().getPropertySources().addFirst(
                        new SystemEnvironmentPropertySource(
                                "test-env",
                                Map.of(
                                        "STORAGE_S3_ENABLED", "true",
                                        "STORAGE_S3_BUCKET", "env-bucket",
                                        "STORAGE_S3_REGION", "us-west-1",
                                        "STORAGE_S3_ENDPOINT", "http://localhost:9000",
                                        "STORAGE_S3_ACCESS_KEY", "env-access",
                                        "STORAGE_S3_SECRET_KEY", "env-secret",
                                        "STORAGE_S3_PATH_STYLE_ACCESS", "true",
                                        "STORAGE_S3_FORCE_PATH_STYLE", "true",
                                        "STORAGE_S3_USE_IAM_ROLE", "false",
                                        "STORAGE_S3_PROFILE_NAME", "default"
                                )
                        )
                ))
                .run(context -> {
                    StorageS3Properties properties = context.getBean(StorageS3Properties.class);
                    assertTrue(properties.isEnabled());
                    assertEquals("env-bucket", properties.getBucket());
                    assertEquals("us-west-1", properties.getRegion());
                    assertEquals("http://localhost:9000", properties.getEndpoint());
                    assertEquals("env-access", properties.getAccessKey());
                    assertEquals("env-secret", properties.getSecretKey());
                    assertTrue(properties.isPathStyleAccess());
                    assertTrue(properties.isForcePathStyle());
                    assertEquals("default", properties.getProfileName());
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(StorageS3Properties.class)
    static class BindingTestConfig {
    }
}
