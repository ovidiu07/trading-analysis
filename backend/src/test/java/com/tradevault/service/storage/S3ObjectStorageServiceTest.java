package com.tradevault.service.storage;

import com.tradevault.config.S3ClientConfig;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.awscore.exception.AwsErrorDetails;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.SdkHttpFullResponse;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class S3ObjectStorageServiceTest {

    @Test
    void putObjectUsesResolvedBucketAndMetadata() {
        S3Client s3Client = mock(S3Client.class);
        S3Presigner s3Presigner = mock(S3Presigner.class);
        S3ObjectStorageService service = new S3ObjectStorageService(s3Client, s3Presigner, settings());

        service.putObject(" notebook/2026/test.png ", "png".getBytes(StandardCharsets.UTF_8), "image/png");

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = requestCaptor.getValue();
        assertEquals("assets", request.bucket());
        assertEquals("notebook/2026/test.png", request.key());
        assertEquals("image/png", request.contentType());
        assertEquals(3L, request.contentLength());
    }

    @Test
    void putObjectTranslatesProviderErrorsWithActionableContext() {
        S3Client s3Client = mock(S3Client.class);
        S3Presigner s3Presigner = mock(S3Presigner.class);
        S3ObjectStorageService service = new S3ObjectStorageService(s3Client, s3Presigner, settings());

        S3Exception exception = (S3Exception) S3Exception.builder()
                .statusCode(400)
                .awsErrorDetails(AwsErrorDetails.builder()
                        .errorCode("SignatureDoesNotMatch")
                        .errorMessage("The request signature we calculated does not match the signature you provided")
                        .sdkHttpResponse(SdkHttpFullResponse.builder().statusCode(400).build())
                        .build())
                .message("SignatureDoesNotMatch")
                .build();
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class))).thenThrow(exception);

        IllegalStateException thrown = assertThrows(
                IllegalStateException.class,
                () -> service.putObject("uploads/test.png", "png".getBytes(StandardCharsets.UTF_8), "image/png")
        );

        assertTrue(thrown.getMessage().contains("bucket='assets'"));
        assertTrue(thrown.getMessage().contains("endpoint='https://storage.example.com'"));
        assertTrue(thrown.getMessage().contains("region='eu-central-1'"));
        assertTrue(thrown.getMessage().contains("pathStyleAccess=true"));
        assertTrue(thrown.getMessage().contains("SignatureDoesNotMatch"));
        assertTrue(thrown.getMessage().contains("Verify storage.s3 bucket/region/endpoint/credentials/path-style configuration."));
    }

    private S3ClientConfig.S3ResolvedSettings settings() {
        return new S3ClientConfig.S3ResolvedSettings(
                true,
                "assets",
                Region.of("eu-central-1"),
                URI.create("https://storage.example.com"),
                true,
                false,
                StaticCredentialsProvider.create(AwsBasicCredentials.create("access", "secret")),
                "static"
        );
    }
}
