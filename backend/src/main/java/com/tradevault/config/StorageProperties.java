package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "storage")
@Getter
@Setter
public class StorageProperties {
    private String provider = "s3";
    private final S3 s3 = new S3();

    @Getter
    @Setter
    public static class S3 {
        private String bucket = "tradejaudit-assets";
        private String region = "us-east-1";
        private String endpoint;
        private String accessKey = "";
        private String secretKey = "";
        private String publicBaseUrl;
        private boolean pathStyleAccess = false;
        private final Presign presign = new Presign();
    }

    @Getter
    @Setter
    public static class Presign {
        private boolean enabled = false;
        private int expirationMinutes = 60;
    }
}
