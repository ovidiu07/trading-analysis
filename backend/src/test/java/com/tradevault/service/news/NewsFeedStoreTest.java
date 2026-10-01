package com.tradevault.service.news;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="NEWS_TEST_DB",matches="jdbc:postgresql://localhost(?::[0-9]+)?/tradevault_news_qa_[a-z0-9_]+")
class NewsFeedStoreTest {
    JdbcTemplate jdbc;NewsFeedStore store;TransactionTemplate tx;
    Instant now=Instant.parse("2026-10-01T12:00:00Z");
    @BeforeEach void setup() {
        var ds=new DriverManagerDataSource(System.getenv("NEWS_TEST_DB")+"?currentSchema=tradevault",System.getProperty("user.name"),"");
        jdbc=new JdbcTemplate(ds);store=new NewsFeedStore(jdbc,new ObjectMapper().findAndRegisterModules());tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
    }
    @Test void concurrentClaimsAndQuotaAreAtomicAcrossConnections() throws Exception {
        String id=UUID.randomUUID().toString();
        try(var pool=Executors.newFixedThreadPool(12)) {
            List<Callable<UUID>> claims=new ArrayList<>();for(int i=0;i<24;i++)claims.add(()->store.claim(id,now));
            int winners=0;for(var future:pool.invokeAll(claims))if(future.get()!=null)winners++;
            assertThat(winners).isEqualTo(1);
            List<Callable<Boolean>> budget=new ArrayList<>();for(int i=0;i<24;i++)budget.add(()->store.reserve(id,now,7));
            int reserved=0;for(var future:pool.invokeAll(budget))if(future.get())reserved++;
            assertThat(reserved).isEqualTo(7);
            assertThat(store.reserve(id,now.plusSeconds(86400),7)).isTrue();
        }
    }
    @Test void asOfHistoryStaleRetentionAndLeaseFencing() {
        String id=UUID.randomUUID().toString();var token=store.claim(id,now);
        var old=NewsModels.Payload.news(List.of(new NewsModels.Story("story","Original headline","Fed","https://www.federalreserve.gov/",now.minusSeconds(10),null,null,"US_MACRO",Set.of())));
        tx.executeWithoutResult(s->store.success(id,token,now,Duration.ofMinutes(30),old));
        assertThat(store.claim(id,now.plusSeconds(2))).isNull();
        store.requestRefresh(id,now.plusSeconds(30));assertThat(store.claim(id,now.plusSeconds(31))).isNull();
        Instant later=now.plusSeconds(1801);var next=store.claim(id,later);
        store.failure(id,next,later,Duration.ofMinutes(30),"FAILED");
        assertThat(store.state(id).status()).isEqualTo("FAILED");
        assertThat(store.snapshots(id,now.minusSeconds(100),later,false).getFirst().payload()).isEqualTo(old);
        tx.executeWithoutResult(s->store.success(id,token,later,Duration.ofMinutes(30),NewsModels.Payload.news(List.of())));
        assertThat(store.snapshots(id,now.minusSeconds(100),later,false).getFirst().payload()).isEqualTo(old);
        assertThat(store.snapshots(id,now.minusSeconds(100),now.minusSeconds(1),false)).isEmpty();
        assertThatThrownBy(()->jdbc.update("UPDATE news_feed_snapshot SET payload='{}' WHERE feed_id=?",id)).hasMessageContaining("immutable");
    }
    @Test void expiredWorkerCannotOverwriteNewOwnerAndManualRefreshHonorsFailureBackoff() {
        String id=UUID.randomUUID().toString();var original=store.claim(id,now);var successor=store.claim(id,now.plusSeconds(121));
        assertThat(successor).isNotNull();
        tx.executeWithoutResult(s->store.success(id,original,now.plusSeconds(122),Duration.ofMinutes(30),NewsModels.Payload.news(List.of())));
        assertThat(store.snapshots(id,now,now.plusSeconds(123),false)).isEmpty();
        store.failure(id,successor,now.plusSeconds(123),Duration.ofHours(6),"FAILED");
        store.requestRefresh(id,now.plusSeconds(3600));
        assertThat(store.claim(id,now.plusSeconds(3601))).isNull();
    }
}
