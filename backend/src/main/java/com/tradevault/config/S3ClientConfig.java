package com.tradevault.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.ProfileCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class S3ClientConfig {
    private final Environment environment;

    @Bean
    public S3ResolvedSettings s3ResolvedSettings(StorageS3Properties properties) {
        S3ResolvedSettings settings = resolveSettings(properties);
        log.info(
                "S3 storage configured: enabled={}, bucket={}, region={}, endpointConfigured={}, pathStyleAccess={}, credentialSource={}",
                settings.enabled(),
                settings.bucket(),
                settings.region().id(),
                settings.endpoint() != null,
                settings.pathStyleAccess(),
                settings.credentialSource()
        );
        return settings;
    }

    @Bean
    public S3Client s3Client(S3ResolvedSettings settings) {
        var builder = S3Client.builder()
                .region(settings.region())
                .credentialsProvider(settings.credentialsProvider())
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(settings.pathStyleAccess())
                        .build());

        if (settings.endpoint() != null) {
            builder.endpointOverride(settings.endpoint());
        }

        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner(S3ResolvedSettings settings) {
        var builder = S3Presigner.builder()
                .region(settings.region())
                .credentialsProvider(settings.credentialsProvider())
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(settings.pathStyleAccess())
                        .build());

        if (settings.endpoint() != null) {
            builder.endpointOverride(settings.endpoint());
        }

        return builder.build();
    }

    @Bean
    public InfoContributor s3InfoContributor(S3ResolvedSettings settings) {
        return builder -> {
            Map<String, Object> s3Info = new LinkedHashMap<>();
            s3Info.put("enabled", settings.enabled());
            s3Info.put("endpointConfigured", settings.endpoint() != null);
            s3Info.put("region", settings.region().id());
            s3Info.put("credentialSource", settings.credentialSource());
            s3Info.put("bucket", settings.bucket());
            s3Info.put("pathStyleAccess", settings.pathStyleAccess());
            builder.withDetail("s3", s3Info);
        };
    }

    S3ResolvedSettings resolveSettings(StorageS3Properties s3) {
        boolean enabled = s3.isEnabled();
        String bucket = resolveBucket(s3, enabled);
        Region region = resolveRegion(s3, enabled);
        URI endpoint = resolveEndpoint(s3);
        boolean pathStyle = resolvePathStyle(s3);
        ResolvedCredentials credentials = resolveCredentialsProvider(s3, enabled);

        return new S3ResolvedSettings(
                enabled,
                bucket,
                region,
                endpoint,
                pathStyle,
                credentials.provider(),
                credentials.source()
        );
    }

    private String resolveBucket(StorageS3Properties s3, boolean required) {
        String configuredBucket = firstNonBlank(
                s3.getBucket(),
                environment.getProperty("STORAGE_S3_BUCKET")
        );
        if (required && !StringUtils.hasText(configuredBucket)) {
            throw new IllegalStateException(
                    "S3 bucket is not configured. Set storage.s3.bucket or STORAGE_S3_BUCKET."
            );
        }
        return StringUtils.hasText(configuredBucket) ? configuredBucket.trim() : "disabled-storage";
    }

    Region resolveRegion(StorageS3Properties s3, boolean required) {
        String configuredRegion = firstNonBlank(
                s3.getRegion(),
                environment.getProperty("STORAGE_S3_REGION"),
                environment.getProperty("AWS_REGION")
        );
        if (StringUtils.hasText(configuredRegion)) {
            return Region.of(configuredRegion.trim());
        }
        if (required) {
            throw new IllegalStateException(
                    "S3 region is not configured. Set storage.s3.region/STORAGE_S3_REGION or AWS_REGION."
            );
        }
        return Region.US_EAST_1;
    }

    private URI resolveEndpoint(StorageS3Properties s3) {
        String configuredEndpoint = firstNonBlank(
                s3.getEndpoint(),
                environment.getProperty("STORAGE_S3_ENDPOINT")
        );
        if (!StringUtils.hasText(configuredEndpoint)) {
            return null;
        }
        try {
            return URI.create(configuredEndpoint.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(
                    "Invalid S3 endpoint URI. Set storage.s3.endpoint/STORAGE_S3_ENDPOINT to a valid URL.",
                    ex
            );
        }
    }

    private boolean resolvePathStyle(StorageS3Properties s3) {
        if (s3.isForcePathStyle() || s3.isPathStyleAccess()) {
            return true;
        }
        String explicitPathStyle = firstNonBlank(
                environment.getProperty("STORAGE_S3_PATH_STYLE"),
                environment.getProperty("STORAGE_S3_PATH_STYLE_ACCESS")
        );
        return Boolean.parseBoolean(explicitPathStyle);
    }

    private ResolvedCredentials resolveCredentialsProvider(StorageS3Properties s3, boolean required) {
        String accessKey = firstNonBlank(
                s3.getAccessKey(),
                environment.getProperty("STORAGE_S3_ACCESS_KEY"),
                environment.getProperty("AWS_ACCESS_KEY_ID"),
                readSecretFromFileEnv("STORAGE_S3_ACCESS_KEY_FILE"),
                readSecretFromFileEnv("AWS_ACCESS_KEY_ID_FILE")
        );
        String secretKey = firstNonBlank(
                s3.getSecretKey(),
                environment.getProperty("STORAGE_S3_SECRET_KEY"),
                environment.getProperty("AWS_SECRET_ACCESS_KEY"),
                readSecretFromFileEnv("STORAGE_S3_SECRET_KEY_FILE"),
                readSecretFromFileEnv("AWS_SECRET_ACCESS_KEY_FILE")
        );

        boolean hasAccessKey = StringUtils.hasText(accessKey);
        boolean hasSecretKey = StringUtils.hasText(secretKey);
        if (hasAccessKey != hasSecretKey) {
            throw new IllegalStateException(
                    "Both storage.s3.access-key and storage.s3.secret-key must be configured together " +
                    "(or provide AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)."
            );
        }
        if (hasAccessKey) {
            AwsCredentialsProvider provider = StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKey.trim(), secretKey.trim())
            );
            return new ResolvedCredentials(provider, "static");
        }

        String profileName = firstNonBlank(
                s3.getProfileName(),
                environment.getProperty("STORAGE_S3_PROFILE_NAME"),
                environment.getProperty("AWS_PROFILE")
        );
        if (StringUtils.hasText(profileName)) {
            return new ResolvedCredentials(ProfileCredentialsProvider.create(profileName.trim()), "profile");
        }

        boolean useIamRole = s3.isUseIamRole() || Boolean.parseBoolean(environment.getProperty("STORAGE_S3_USE_IAM_ROLE"));
        if (useIamRole) {
            return new ResolvedCredentials(DefaultCredentialsProvider.create(), "defaultChain");
        }

        if (required) {
            throw new IllegalStateException(
                    "S3 credentials are not configured. Set storage.s3.access-key/storage.s3.secret-key " +
                    "(or STORAGE_S3_ACCESS_KEY/STORAGE_S3_SECRET_KEY, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY), " +
                    "or enable IAM role credentials with storage.s3.use-iam-role=true/STORAGE_S3_USE_IAM_ROLE=true."
            );
        }

        return new ResolvedCredentials(DefaultCredentialsProvider.create(), "defaultChain");
    }

    private String readSecretFromFileEnv(String envKey) {
        String path = environment.getProperty(envKey);
        if (!StringUtils.hasText(path)) {
            return null;
        }
        try {
            String value = Files.readString(Path.of(path.trim()));
            return StringUtils.hasText(value) ? value.trim() : null;
        } catch (IOException ex) {
            throw new IllegalStateException("Could not read S3 secret file configured by " + envKey, ex);
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    public record S3ResolvedSettings(
            boolean enabled,
            String bucket,
            Region region,
            URI endpoint,
            boolean pathStyleAccess,
            AwsCredentialsProvider credentialsProvider,
            String credentialSource
    ) {}

    private record ResolvedCredentials(AwsCredentialsProvider provider, String source) {}
}
