package com.tradevault.service.storage;

import com.tradevault.config.StorageProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class S3ObjectStorageService implements ObjectStorageService {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final StorageProperties storageProperties;

    @Override
    public void putObject(String key, byte[] content, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket())
                .key(key)
                .contentType(contentType)
                .contentLength((long) content.length)
                .build();
        s3Client.putObject(request, software.amazon.awssdk.core.sync.RequestBody.fromBytes(content));
    }

    @Override
    public void deleteObject(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket())
                .key(key)
                .build();
        s3Client.deleteObject(request);
    }

    @Override
    public StoredObject getObject(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket())
                .key(key)
                .build();
        var stream = s3Client.getObject(request);
        GetObjectResponse response = stream.response();
        return new StoredObject(stream, response.contentType(), response.contentLength());
    }

    @Override
    public String presignGetObjectUrl(String key, Duration duration) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket())
                .key(key)
                .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .getObjectRequest(request)
                .signatureDuration(duration)
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    private String bucket() {
        String bucket = storageProperties.getS3().getBucket();
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("storage.s3.bucket is not configured");
        }
        return bucket.trim();
    }
}
