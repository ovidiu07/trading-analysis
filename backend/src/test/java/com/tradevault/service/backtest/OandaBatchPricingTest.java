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
                  {"instrument":"GBP_USD","tradeable":true,"time":"2026-09-24T10:00:00.000000000Z","bids":[{"price":"1.2500"}],"asks":[{"price":"1.2502"}]},
                  {"instrument":"DE30_EUR","status":"non-tradeable","time":"2026-09-24T10:00:00.000000000Z","bids":[],"asks":[],"closeoutBid":"18000.0","closeoutAsk":"18002.0"}
                ]}
                """, MediaType.APPLICATION_JSON));

        var quotes = provider.getQuotes("secret-token", "acct-1", OandaEnvironment.PRACTICE, List.of("GBP_USD", "DE30_EUR"));

        assertThat(quotes).hasSize(2);
        assertThat(quotes.get("GBP_USD").priceBasis()).isEqualTo("MID");
        assertThat(quotes.get("GBP_USD").tradeable()).isTrue();
        assertThat(quotes.get("DE30_EUR").priceBasis()).isEqualTo("CLOSEOUT_MID");
        assertThat(quotes.get("DE30_EUR").bid()).isEqualByComparingTo(new BigDecimal("18000.0"));
        assertThat(quotes.get("DE30_EUR").tradeable()).isFalse();
        server.verify();
    }
    @Test void discoversExactAccountInstrumentsWithoutInventingAliases() {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
        OandaCandleProvider provider = new OandaCandleProvider(new ObjectMapper(), http);
        ReflectionTestUtils.setField(provider, "liveBaseUrl", "https://live.example/v3");
        server.expect(request -> {
            assertThat(request.getURI().toString()).isEqualTo("https://live.example/v3/accounts/account-live/instruments");
            assertThat(request.getHeaders().getFirst("Authorization")).isEqualTo("Bearer private");
        }).andRespond(withSuccess("{\"instruments\":[{\"name\":\"EUR_USD\"},{\"name\":\"EUR_USD\"},{\"name\":\"SPX500_USD\"},{\"name\":\"../ES\"}]}", MediaType.APPLICATION_JSON));
        assertThat(provider.listInstruments("private", "account-live", OandaEnvironment.LIVE)).containsExactly("EUR_USD", "SPX500_USD");
        server.verify();
    }

    @Test void retriesTransientFailureOnceButNeverRetriesRejectedCredentials() {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
        OandaCandleProvider provider = new OandaCandleProvider(new ObjectMapper(), http);
        ReflectionTestUtils.setField(provider, "practiceBaseUrl", "https://practice.example/v3");
        server.expect(method(HttpMethod.GET)).andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withServerError());
        server.expect(method(HttpMethod.GET)).andRespond(withSuccess("{\"prices\":[]}", MediaType.APPLICATION_JSON));
        assertThat(provider.getQuotes("private", "account", OandaEnvironment.PRACTICE, List.of("EUR_USD"))).isEmpty();
        server.verify();
        server.reset();
        server.expect(method(HttpMethod.GET)).andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> provider.getQuotes("private", "account", OandaEnvironment.PRACTICE, List.of("EUR_USD")))
            .isInstanceOf(com.tradevault.exception.BacktestDomainException.class)
            .hasMessageContaining("rejected");
        server.verify();
    }

    @Test void rejectsMalformedCrossedAndUnrequestedPrices() {
        RestTemplate http = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(http).build();
        OandaCandleProvider provider = new OandaCandleProvider(new ObjectMapper(), http);
        ReflectionTestUtils.setField(provider, "practiceBaseUrl", "https://practice.example/v3");
        server.expect(method(HttpMethod.GET)).andRespond(withSuccess("""
          {"prices":[
            {"instrument":"GBP_USD","time":"2026-09-25T12:00:00Z","bids":[{"price":"2"}],"asks":[{"price":"1"}]},
            {"instrument":"EUR_USD","time":"2026-09-25T12:00:00Z","bids":[{"price":"1"}],"asks":[{"price":"2"}]}
          ]}
          """, MediaType.APPLICATION_JSON));
        assertThat(provider.getQuotes("private", "account", OandaEnvironment.PRACTICE, List.of("GBP_USD"))).isEmpty();
        server.verify();
    }

}
