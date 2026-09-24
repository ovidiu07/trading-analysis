package com.tradevault.service.backtest;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OandaBatchPricingTest {
    @Test
    void sendsOneInstrumentBatchAndRetainsCloseoutPriceBasis() {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
        OandaCandleProvider provider = new OandaCandleProvider(new ObjectMapper(), http);
        ReflectionTestUtils.setField(provider, "practiceBaseUrl", "https://practice.example/v3");
        server.expect(request -> {
            assertThat(request.getMethod()).isEqualTo(HttpMethod.GET);
            assertThat(request.getURI().getPath()).isEqualTo("/v3/accounts/acct-1/pricing");
            assertThat(request.getURI().getRawQuery()).contains("instruments=DE30_EUR,GBP_USD");
            assertThat(request.getHeaders().getFirst("Authorization")).isEqualTo("Bearer secret-token");
        }).andRespond(withSuccess("""
                {"prices":[
                  {"instrument":"GBP_USD","status":"tradeable","time":"2026-09-24T10:00:00.000000000Z","bids":[{"price":"1.2500"}],"asks":[{"price":"1.2502"}]},
                  {"instrument":"DE30_EUR","status":"non-tradeable","time":"2026-09-24T10:00:00.000000000Z","bids":[],"asks":[],"closeoutBid":"18000.0","closeoutAsk":"18002.0"}
                ]}
                """, MediaType.APPLICATION_JSON));

        var quotes = provider.getQuotes("secret-token", "acct-1", OandaEnvironment.PRACTICE, List.of("GBP_USD", "DE30_EUR"));

        assertThat(quotes).hasSize(2);
        assertThat(quotes.get("GBP_USD").priceBasis()).isEqualTo("MID");
        assertThat(quotes.get("GBP_USD").tradeable()).isTrue();
        assertThat(quotes.get("DE30_EUR").priceBasis()).isEqualTo("CLOSE");
        assertThat(quotes.get("DE30_EUR").bid()).isEqualByComparingTo(new BigDecimal("18000.0"));
        assertThat(quotes.get("DE30_EUR").tradeable()).isFalse();
        server.verify();
    }
}
