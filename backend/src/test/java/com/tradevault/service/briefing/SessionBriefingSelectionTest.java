package com.tradevault.service.briefing;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
class SessionBriefingSelectionTest {
 @ParameterizedTest @CsvSource({
 "2026-09-07T07:00:00Z,ASIA", "2026-09-07T14:14:59Z,ASIA", "2026-09-07T14:15:00Z,LONDON",
 "2026-09-07T20:29:59Z,LONDON", "2026-09-07T20:30:00Z,DAY_RECAP", "2026-01-05T15:14:59Z,ASIA",
 "2026-01-05T15:15:00Z,LONDON", "2026-01-05T21:30:00Z,DAY_RECAP", "2026-03-09T15:15:00Z,LONDON",
 "2026-03-30T14:15:00Z,LONDON", "2026-10-26T15:15:00Z,LONDON", "2026-09-07T21:59:59Z,DAY_RECAP",
 "2026-09-07T22:00:00Z,ASIA", "2026-03-29T00:59:59Z,ASIA", "2026-03-29T01:00:00Z,ASIA",
 "2026-10-25T00:59:59Z,ASIA", "2026-10-25T01:00:00Z,ASIA"})
 void berlinThresholds(String instant,String expected){assertThat(SessionBriefingService.preferred(Instant.parse(instant)).name()).isEqualTo(expected);}
}
