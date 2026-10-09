package com.tradevault.service;

import com.tradevault.service.backtesting.BacktestingSessionClassifier;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.LocalDate;
import java.time.LocalTime;
import static org.assertj.core.api.Assertions.assertThat;

class BacktestingSessionClassifierTest {
    @ParameterizedTest
    @CsvSource(value = {"10:29:59|", "10:30|London", "16:25:59|London", "16:26|", "16:29:59|", "16:30|New York", "23:00:59|New York", "23:01|", "00:00|"}, delimiter = '|')
    void classifiesInclusiveEndpointMinutesAndLeavesGapsUnclassified(String time, String expected) {
        assertThat(BacktestingSessionClassifier.classify(LocalDate.of(2025, 10, 24), LocalTime.parse(time), null)).isEqualTo(expected);
    }
    @ParameterizedTest
    @CsvSource({"2025-10-24,07:30,London", "2025-10-28,08:30,London", "2025-10-24,13:30,New York", "2025-10-28,14:30,New York", "2025-10-24,13:27,", "2025-10-28,13:27,London"})
    void convertsTheRecordedTimezoneUsingTheTradeDateAndDaylightSaving(String date, String time, String expected) {
        assertThat(BacktestingSessionClassifier.classify(LocalDate.parse(date), LocalTime.parse(time), "UTC")).isEqualTo(expected);
    }
}
