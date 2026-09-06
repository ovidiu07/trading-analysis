package com.tradevault.service.today;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import java.math.BigDecimal;
import com.tradevault.service.backtest.CanonicalCandle;
import com.tradevault.domain.enums.*;
import static org.assertj.core.api.Assertions.*;
class BriefingMathTest {
 @Test void productThresholdsAndManualSelection() {
  for(String time:List.of("15:59","16:00","16:10","16:15","16:20")) {
   Instant now=LocalDate.of(2026,9,4).atTime(LocalTime.parse(time)).atZone(ZoneId.of("Europe/Bucharest")).toInstant();
   assertThat(BriefingMath.select(now,"ASIA",null)).isEqualTo(time.compareTo("16:15")<0 ? "ASIA":"LONDON");
   assertThat(BriefingMath.select(now,"ASIA","LONDON")).isEqualTo("LONDON");
  }
 }
 @Test void windowsUseTheirOwnSeasonalTimezone() {
  assertThat(BriefingMath.start(LocalDate.of(2026,1,5),"LONDON").getOffset()).isEqualTo(ZoneOffset.UTC);
  assertThat(BriefingMath.start(LocalDate.of(2026,7,6),"LONDON").getOffset()).isEqualTo(ZoneOffset.ofHours(1));
  assertThat(BriefingMath.start(LocalDate.of(2026,7,6),"ASIA").getOffset()).isEqualTo(ZoneOffset.ofHours(9));
 }
 CanonicalCandle bar(LocalDate date,int hour,String symbol) {
  return new CanonicalCandle(BacktestCandleSource.OANDA,"test",symbol,symbol,BacktestTimeframe.H1,date.atTime(hour,0).atOffset(ZoneOffset.UTC),BigDecimal.valueOf(100),BigDecimal.valueOf(110),BigDecimal.valueOf(90),BigDecimal.valueOf(105),BigDecimal.ONE);
 }
 @Test void deterministicRangeWeekendFallbackAndNoInstrumentMixing() {
  var bars=new ArrayList<CanonicalCandle>();
  for(LocalDate d=LocalDate.of(2026,8,1); !d.isAfter(LocalDate.of(2026,9,4)); d=d.plusDays(1))
   if(d.getDayOfWeek().getValue()<6) for(int hour=0;hour<6;hour++) bars.add(bar(d,hour,"GER40"));
  bars.add(bar(LocalDate.of(2026,9,7),0,"GER40")); bars.add(bar(LocalDate.of(2026,9,6),0,"NAS100"));
  var summary=BriefingMath.summarize(bars,"GER40","ASIA",Instant.parse("2026-09-06T12:00:00Z"));
  assertThat(summary.get("dataDate")).isEqualTo("2026-09-04"); assertThat(summary.get("status")).isEqualTo("close");
  assertThat(summary.get("lower")).isEqualTo(90.0); assertThat(summary.get("upper")).isEqualTo(110.0); assertThat(summary.get("observations")).isEqualTo(20);
 }
 @Test void missingFridayUsesActualPriorDateAndIncompleteBarsAreExcluded() {
  var bars=List.of(bar(LocalDate.of(2026,9,3),0,"GER40"),bar(LocalDate.of(2026,9,3),1,"GER40"));
  var summary=BriefingMath.summarize(bars,"GER40","ASIA",Instant.parse("2026-09-06T12:00:00Z"));
  assertThat(summary.get("dataDate")).isEqualTo("2026-09-03"); assertThat(summary.get("rangeStatus")).isEqualTo("unavailable");
  var partial=BriefingMath.summarize(bars,"GER40","ASIA",Instant.parse("2026-09-03T01:30:00Z"));
  assertThat(partial.get("observedUntil")).isEqualTo("2026-09-03T01:00Z");
 }
}
