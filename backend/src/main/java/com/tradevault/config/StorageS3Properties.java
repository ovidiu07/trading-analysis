package com.tradevault.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "storage.s3")
@Getter
@Setter
public class StorageS3Properties {
    private boolean enabled = true;
    private String endpoint;
    private String region;
    private String bucket = "tradejaudit";
    private String accessKey;
    private String secretKey;
    private boolean pathStyleAccess = false;
    private boolean forcePathStyle = false;
    private boolean useIamRole = false;
    private String profileName;
    private String publicBaseUrl;
    private final Presign presign = new Presign();

    @Getter
    @Setter
    public static class Presign {
        private boolean enabled = false;
        private int expirationMinutes = 60;
    }
}
