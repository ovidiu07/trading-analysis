package com.tradevault.domain.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BinaryPayloadFieldTypeTest {

    @Test
    void candleChunkPayloadFieldIsByteArray() throws Exception {
        assertThat(CandleChunk.class.getDeclaredField("payload").getType()).isEqualTo(byte[].class);
    }

    @Test
    void backtestCsvUploadPayloadFieldIsByteArray() throws Exception {
        assertThat(BacktestCsvUpload.class.getDeclaredField("filePayload").getType()).isEqualTo(byte[].class);
    }
}
