package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.enums.BacktestTimeframe;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.time.OffsetDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OandaCompletedCandlesTest {
    @Test void requiresExplicitCompletionAndExactResponseInstrumentAndTimeframe() {
        var http = new RestTemplate();var server = MockRestServiceServer.bindTo(http).build();
        var provider = new OandaCandleProvider(new ObjectMapper(), http);
        ReflectionTestUtils.setField(provider, "practiceBaseUrl", "https://practice.example/v3");
        String body = """
          {"instrument":"GBP_USD","granularity":"M5","candles":[
           {"complete":true,"time":"2026-09-24T10:00:00Z","mid":{"o":"1","h":"2","l":"1","c":"2"}},
           {"complete":false,"time":"2026-09-24T10:05:00Z","mid":{"o":"90","h":"99","l":"89","c":"98"}},
           {"time":"2026-09-24T10:10:00Z","mid":{"o":"80","h":"89","l":"79","c":"88"}}
          ]}
          """;
        server.expect(request -> assertThat(request.getURI().toString()).contains("/instruments/GBP_USD/candles", "price=M", "dailyAlignment=17", "alignmentTimezone=America/New_York"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        var from=OffsetDateTime.parse("2026-09-24T00:00:00Z");
        assertThat(provider.getCandles("test-token","account","GBPUSD","GBPUSD",BacktestTimeframe.M5,from,from.plusDays(1))).hasSize(1)
            .allSatisfy(c -> assertThat(c.close()).isEqualByComparingTo("2"));
        server.verify();
        for (var wrong : new String[]{body.replace("GBP_USD","EUR_USD"),body.replace("\"M5\"","\"H1\"")}) {
            server.reset();server.expect(request -> {}).andRespond(withSuccess(wrong,MediaType.APPLICATION_JSON));
            assertThatThrownBy(() -> provider.getCandles("test-token","account","GBPUSD","GBPUSD",BacktestTimeframe.M5,from,from.plusDays(1)))
                .isInstanceOf(com.tradevault.exception.BacktestDomainException.class);
            server.verify();
        }
    }
}
