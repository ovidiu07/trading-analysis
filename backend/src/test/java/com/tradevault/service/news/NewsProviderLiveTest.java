package com.tradevault.service.news;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.opentest4j.TestAbortedException;
import java.time.Instant;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;

/** Real network evidence. HTTP failures are explicitly skipped, never counted as provider success. */
@EnabledIfEnvironmentVariable(named="NEWS_LIVE_SMOKE", matches="true")
class NewsProviderLiveTest {
    @TestFactory Stream<DynamicTest> enabledOfficialProviders() {
        var providers=new NewsProviders(new ObjectMapper().findAndRegisterModules());
        return providers.feeds().stream().map(feed->DynamicTest.dynamicTest(feed.id(),()->{
            try {
                var result=providers.parse(feed,providers.fetch(feed),Instant.now());
                int count=result.news().size()+result.events().size()+result.observations().size();
                assertThat(count).as("Live source has parseable records").isPositive();
                assertThat(result.news()).allMatch(s->s.publishedAt()!=null && s.url().startsWith("https://"));
                assertThat(result.observations()).allMatch(o->o.actual().value()!=null && o.actual().period()!=null);
                if(feed.capability()==NewsModels.Capability.CALENDAR)assertThat(result.events()).allMatch(e->e.scheduledDate()!=null);
                System.out.printf("LIVE VERIFIED %s: news=%d events=%d observations=%d%n",feed.id(),result.news().size(),result.events().size(),result.observations().size());
            }catch(NewsProviders.FetchFailure ex) {
                System.out.printf("LIVE BLOCKED %s: HTTP %d%n",feed.id(),ex.status);
                throw new TestAbortedException("Provider not live verified: HTTP "+ex.status);
            }
        }));
    }
}
