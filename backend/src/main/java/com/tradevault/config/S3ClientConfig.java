package com.tradevault.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class S3ClientConfig {
    @Bean
    public S3Client s3Client(StorageProperties storageProperties) {
        StorageProperties.S3 s3 = storageProperties.getS3();
        var builder = S3Client.builder()
                .region(resolveRegion(s3))
                .credentialsProvider(resolveCredentialsProvider(s3))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(s3.isPathStyleAccess())
                        .build());

        String endpoint = trimToNull(s3.getEndpoint());
        if (endpoint != null) {
            builder.endpointOverride(URI.create(endpoint));
        }

        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner(StorageProperties storageProperties) {
        StorageProperties.S3 s3 = storageProperties.getS3();
        var builder = S3Presigner.builder()
                .region(resolveRegion(s3))
                .credentialsProvider(resolveCredentialsProvider(s3))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(s3.isPathStyleAccess())
                        .build());

        String endpoint = trimToNull(s3.getEndpoint());
        if (endpoint != null) {
            builder.endpointOverride(URI.create(endpoint));
        }

        return builder.build();
    }

    private AwsCredentialsProvider resolveCredentialsProvider(StorageProperties.S3 s3) {
        String accessKey = trimToNull(s3.getAccessKey());
        String secretKey = trimToNull(s3.getSecretKey());
        if (accessKey == null && secretKey == null) {
            return DefaultCredentialsProvider.create();
        }
        if (accessKey == null || secretKey == null) {
            throw new IllegalStateException(
                    "Both storage.s3.access-key and storage.s3.secret-key must be configured together"
            );
        }
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
    }

    private Region resolveRegion(StorageProperties.S3 s3) {
        String configuredRegion = trimToNull(s3.getRegion());
        if (configuredRegion != null) {
            return Region.of(configuredRegion);
        }
        return Region.of("eu-central-1");
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
