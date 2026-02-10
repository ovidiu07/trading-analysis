package com.tradevault.service.storage;

import java.io.InputStream;
import java.time.Duration;

public interface ObjectStorageService {
    void putObject(String key, byte[] content, String contentType);

    void deleteObject(String key);

    StoredObject getObject(String key);

    String presignGetObjectUrl(String key, Duration duration);

    record StoredObject(InputStream stream, String contentType, Long contentLength) {}
}
