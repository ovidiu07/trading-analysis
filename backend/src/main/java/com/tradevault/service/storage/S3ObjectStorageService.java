package com.tradevault.service.storage;

import com.tradevault.config.S3ClientConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3ObjectStorageService implements ObjectStorageService {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final S3ClientConfig.S3ResolvedSettings settings;
    private final AtomicReference<Region> bucketRegionOverride = new AtomicReference<>();

    @Override
    public void putObject(String key, byte[] content, String contentType) {
        ensureEnabled();
        String bucket = bucket();
        String sanitizedKey = key(key);
        byte[] payload = Objects.requireNonNull(content, "content must not be null");
        String safeContentType = StringUtils.hasText(contentType)
                ? contentType.trim()
                : "application/octet-stream";

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(sanitizedKey)
                .contentType(safeContentType)
                .contentLength((long) payload.length)
                .build();
        try {
            s3Client.putObject(request, RequestBody.fromBytes(payload));
        } catch (S3Exception ex) {
            if (retryUploadWithBucketRegionHint(request, payload, sanitizedKey, ex)) {
                return;
            }
            throw storageFailure("upload", sanitizedKey, ex);
        } catch (SdkClientException ex) {
            throw storageFailure("upload", sanitizedKey, ex);
        }
    }

    @Override
    public void deleteObject(String key) {
        ensureEnabled();
        String bucket = bucket();
        String sanitizedKey = key(key);
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(sanitizedKey)
                .build();
        try {
            s3Client.deleteObject(request);
        } catch (S3Exception ex) {
            if (retryDeleteWithBucketRegionHint(request, sanitizedKey, ex)) {
                return;
            }
            throw storageFailure("delete", sanitizedKey, ex);
        } catch (SdkClientException ex) {
            throw storageFailure("delete", sanitizedKey, ex);
        }
    }

    @Override
    public StoredObject getObject(String key) {
        ensureEnabled();
        String bucket = bucket();
        String sanitizedKey = key(key);
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(sanitizedKey)
                .build();
        try {
            return toStoredObject(s3Client.getObject(request), null);
        } catch (S3Exception ex) {
            StoredObject retried = retryGetObjectWithBucketRegionHint(request, sanitizedKey, ex);
            if (retried != null) {
                return retried;
            }
            throw storageFailure("download", sanitizedKey, ex);
        } catch (SdkClientException ex) {
            throw storageFailure("download", sanitizedKey, ex);
        }
    }

    @Override
    public String presignGetObjectUrl(String key, Duration duration) {
        ensureEnabled();
        String bucket = bucket();
        String sanitizedKey = key(key);
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(sanitizedKey)
                .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .getObjectRequest(request)
                .signatureDuration(duration)
                .build();
        Region presignRegion = resolvePresignRegion(bucket);
        if (presignRegion.equals(settings.region())) {
            try {
                return s3Presigner.presignGetObject(presignRequest).url().toString();
            } catch (S3Exception | SdkClientException ex) {
                throw storageFailure("presign", sanitizedKey, ex);
            }
        }

        try (S3Presigner retryPresigner = createPresigner(presignRegion)) {
            log.info(
                    "Using provider bucket region for S3 presign (bucket={}, key={}, configuredRegion={}, presignRegion={}, endpoint={}, pathStyleAccess={}, forcePathStyle={})",
                    bucket,
                    sanitizedKey,
                    settings.region().id(),
                    presignRegion.id(),
                    settings.endpointDisplay(),
                    settings.pathStyleAccess(),
                    settings.forcePathStyle()
            );
            return retryPresigner.presignGetObject(presignRequest).url().toString();
        } catch (S3Exception | SdkClientException ex) {
            throw storageFailure("presign", sanitizedKey, ex);
        }
    }

    private void ensureEnabled() {
        if (!settings.enabled()) {
            throw new IllegalStateException("S3 storage is disabled (storage.s3.enabled=false).");
        }
    }

    private String key(String key) {
        if (!StringUtils.hasText(key)) {
            throw new IllegalArgumentException("S3 key must not be blank");
        }
        return key.trim();
    }

    private String bucket() {
        String bucket = settings.bucket();
        if (!StringUtils.hasText(bucket)) {
            throw new IllegalStateException("storage.s3.bucket is not configured");
        }
        return bucket.trim();
    }

    private boolean retryUploadWithBucketRegionHint(PutObjectRequest request,
                                                    byte[] payload,
                                                    String key,
                                                    S3Exception ex) {
        Region retryRegion = retryRegion(ex);
        if (retryRegion == null) {
            return false;
        }
        log.warn(
                "Retrying S3 upload with provider bucket region hint (bucket={}, key={}, configuredRegion={}, retryRegion={}, endpoint={}, pathStyleAccess={}, forcePathStyle={})",
                request.bucket(),
                key,
                settings.region().id(),
                retryRegion.id(),
                settings.endpointDisplay(),
                settings.pathStyleAccess(),
                settings.forcePathStyle()
        );
        try (S3Client retryClient = createClient(retryRegion, false)) {
            retryClient.putObject(request, RequestBody.fromBytes(payload));
            return true;
        } catch (S3Exception | SdkClientException retryEx) {
            throw storageFailure("upload", key, retryEx);
        }
    }

    private boolean retryDeleteWithBucketRegionHint(DeleteObjectRequest request, String key, S3Exception ex) {
        Region retryRegion = retryRegion(ex);
        if (retryRegion == null) {
            return false;
        }
        log.warn(
                "Retrying S3 delete with provider bucket region hint (bucket={}, key={}, configuredRegion={}, retryRegion={}, endpoint={}, pathStyleAccess={}, forcePathStyle={})",
                request.bucket(),
                key,
                settings.region().id(),
                retryRegion.id(),
                settings.endpointDisplay(),
                settings.pathStyleAccess(),
                settings.forcePathStyle()
        );
        try (S3Client retryClient = createClient(retryRegion, false)) {
            retryClient.deleteObject(request);
            return true;
        } catch (S3Exception | SdkClientException retryEx) {
            throw storageFailure("delete", key, retryEx);
        }
    }

    private StoredObject retryGetObjectWithBucketRegionHint(GetObjectRequest request, String key, S3Exception ex) {
        Region retryRegion = retryRegion(ex);
        if (retryRegion == null) {
            return null;
        }
        log.warn(
                "Retrying S3 download with provider bucket region hint (bucket={}, key={}, configuredRegion={}, retryRegion={}, endpoint={}, pathStyleAccess={}, forcePathStyle={})",
                request.bucket(),
                key,
                settings.region().id(),
                retryRegion.id(),
                settings.endpointDisplay(),
                settings.pathStyleAccess(),
                settings.forcePathStyle()
        );
        S3Client retryClient = createClient(retryRegion, false);
        try {
            return toStoredObject(retryClient.getObject(request), retryClient);
        } catch (RuntimeException ex2) {
            retryClient.close();
            throw storageFailure("download", key, ex2);
        }
    }

    private StoredObject toStoredObject(ResponseInputStream<GetObjectResponse> stream, @Nullable S3Client clientToClose) {
        GetObjectResponse response = stream.response();
        InputStream body = clientToClose == null ? stream : closeClientOnClose(stream, clientToClose);
        return new StoredObject(body, response.contentType(), response.contentLength());
    }

    private InputStream closeClientOnClose(ResponseInputStream<GetObjectResponse> stream, S3Client clientToClose) {
        return new FilterInputStream(stream) {
            @Override
            public void close() throws IOException {
                IOException failure = null;
                try {
                    super.close();
                } catch (IOException ex) {
                    failure = ex;
                }
                try {
                    clientToClose.close();
                } catch (RuntimeException ex) {
                    if (failure == null) {
                        throw ex;
                    }
                    failure.addSuppressed(ex);
                }
                if (failure != null) {
                    throw failure;
                }
            }
        };
    }

    private Region resolvePresignRegion(String bucket) {
        Region cachedRegion = bucketRegionOverride.get();
        if (cachedRegion != null) {
            return cachedRegion;
        }
        if (!settings.crossRegionAccessEnabled()) {
            return settings.region();
        }
        try {
            String bucketRegion = s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build()).bucketRegion();
            Region discovered = rememberBucketRegion(bucketRegion);
            return discovered == null ? settings.region() : discovered;
        } catch (S3Exception | SdkClientException ex) {
            Region hinted = retryRegion(ex);
            if (hinted != null) {
                return hinted;
            }
            log.debug(
                    "Could not resolve S3 bucket region for presign (bucket={}, configuredRegion={}, endpoint={})",
                    bucket,
                    settings.region().id(),
                    settings.endpointDisplay(),
                    ex
            );
            return settings.region();
        }
    }

    @Nullable
    private Region retryRegion(Throwable throwable) {
        if (!(throwable instanceof S3Exception s3Exception)) {
            return null;
        }
        String bucketRegionHint = bucketRegionHint(s3Exception);
        if (!StringUtils.hasText(bucketRegionHint)) {
            return null;
        }
        Region retryRegion = rememberBucketRegion(bucketRegionHint);
        if (retryRegion == null || retryRegion.equals(settings.region())) {
            return null;
        }
        return retryRegion;
    }

    @Nullable
    private Region rememberBucketRegion(@Nullable String bucketRegion) {
        if (!StringUtils.hasText(bucketRegion)) {
            return null;
        }
        Region region = Region.of(bucketRegion.trim());
        bucketRegionOverride.compareAndSet(null, region);
        return bucketRegionOverride.get();
    }

    private S3Client createClient(Region region, boolean crossRegionAccessEnabled) {
        var builder = S3Client.builder()
                .region(region)
                .credentialsProvider(settings.credentialsProvider())
                .forcePathStyle(settings.forcePathStyle())
                .crossRegionAccessEnabled(crossRegionAccessEnabled)
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(settings.forcePathStyle() ? null : settings.pathStyleAccess())
                        .build());
        if (settings.endpoint() != null) {
            builder.endpointOverride(settings.endpoint());
        }
        return builder.build();
    }

    private S3Presigner createPresigner(Region region) {
        var builder = S3Presigner.builder()
                .region(region)
                .credentialsProvider(settings.credentialsProvider())
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(settings.pathStyleAccess())
                        .build());
        if (settings.endpoint() != null) {
            builder.endpointOverride(settings.endpoint());
        }
        return builder.build();
    }

    private IllegalStateException storageFailure(String operation, String key, Throwable throwable) {
        String errorCode = null;
        String providerMessage = collapseMessage(throwable.getMessage());
        Integer statusCode = null;
        String requestId = null;
        String extendedRequestId = null;
        String bucketRegionHint = null;
        if (throwable instanceof S3Exception s3Exception) {
            statusCode = s3Exception.statusCode();
            requestId = collapseMessage(s3Exception.requestId());
            extendedRequestId = collapseMessage(s3Exception.extendedRequestId());
            bucketRegionHint = bucketRegionHint(s3Exception);
            if (s3Exception.awsErrorDetails() != null) {
                errorCode = collapseMessage(s3Exception.awsErrorDetails().errorCode());
                providerMessage = firstNonBlank(
                        collapseMessage(s3Exception.awsErrorDetails().errorMessage()),
                        providerMessage
                );
            }
        }

        log.error(
                "S3 {} failed (bucket={}, key={}, endpoint={}, region={}, pathStyleAccess={}, forcePathStyle={}, crossRegionAccess={}, bucketRegionHint={}, exceptionType={}, errorCode={}, statusCode={}, requestId={}, extendedRequestId={}, message={})",
                operation,
                bucket(),
                key,
                settings.endpointDisplay(),
                settings.region().id(),
                settings.pathStyleAccess(),
                settings.forcePathStyle(),
                settings.crossRegionAccessEnabled(),
                firstNonBlank(bucketRegionHint, "<none>"),
                throwable.getClass().getSimpleName(),
                firstNonBlank(errorCode, "<none>"),
                statusCode,
                firstNonBlank(requestId, "<none>"),
                firstNonBlank(extendedRequestId, "<none>"),
                firstNonBlank(providerMessage, "<none>"),
                throwable
        );

        StringBuilder message = new StringBuilder("S3 ")
                .append(operation)
                .append(" failed for bucket='").append(bucket()).append('\'')
                .append(", endpoint='").append(settings.endpointDisplay()).append('\'')
                .append(", region='").append(settings.region().id()).append('\'')
                .append(", pathStyleAccess=").append(settings.pathStyleAccess())
                .append(", forcePathStyle=").append(settings.forcePathStyle());
        if (StringUtils.hasText(errorCode)) {
            message.append(". Provider error=").append(errorCode);
        }
        if (StringUtils.hasText(providerMessage)) {
            message.append(". Provider message=").append(providerMessage);
        }
        if (StringUtils.hasText(bucketRegionHint) && !bucketRegionHint.equals(settings.region().id())) {
            message.append(". Provider reports bucket region='").append(bucketRegionHint).append('\'')
                    .append(" but the client is configured for region='").append(settings.region().id()).append('\'');
        }
        message.append(". Verify storage.s3 bucket/region/endpoint/credentials/path-style configuration.");
        return new IllegalStateException(message.toString(), throwable);
    }

    @Nullable
    private String bucketRegionHint(S3Exception exception) {
        if (exception.awsErrorDetails() == null || exception.awsErrorDetails().sdkHttpResponse() == null) {
            return null;
        }
        return collapseMessage(
                exception.awsErrorDetails().sdkHttpResponse().firstMatchingHeader("x-amz-bucket-region").orElse(null)
        );
    }

    @Nullable
    private String collapseMessage(@Nullable String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    @Nullable
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
}
