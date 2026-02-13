package com.tradevault.service.storage;

import com.tradevault.config.StorageS3Properties;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3ObjectStorageService implements ObjectStorageService {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final StorageS3Properties storageS3Properties;

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
        } catch (S3Exception | SdkClientException ex) {
            log.error("S3 putObject failed (bucket={}, key={})", bucket, sanitizedKey, ex);
            throw new IllegalStateException(
                    "S3 upload failed. Verify storage.s3 bucket/region/endpoint/credentials configuration.",
                    ex
            );
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
        } catch (S3Exception | SdkClientException ex) {
            log.warn("S3 deleteObject failed (bucket={}, key={})", bucket, sanitizedKey, ex);
            throw new IllegalStateException("S3 delete failed. Verify storage.s3 configuration.", ex);
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
            var stream = s3Client.getObject(request);
            GetObjectResponse response = stream.response();
            return new StoredObject(stream, response.contentType(), response.contentLength());
        } catch (S3Exception | SdkClientException ex) {
            log.error("S3 getObject failed (bucket={}, key={})", bucket, sanitizedKey, ex);
            throw new IllegalStateException("S3 download failed. Verify storage.s3 configuration.", ex);
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
        try {
            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (S3Exception | SdkClientException ex) {
            log.error("S3 presignGetObject failed (bucket={}, key={})", bucket, sanitizedKey, ex);
            throw new IllegalStateException("S3 presign failed. Verify storage.s3 configuration.", ex);
        }
    }

    private void ensureEnabled() {
        if (!storageS3Properties.isEnabled()) {
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
        String bucket = storageS3Properties.getBucket();
        if (!StringUtils.hasText(bucket)) {
            throw new IllegalStateException("storage.s3.bucket is not configured");
        }
        return bucket.trim();
    }
}
