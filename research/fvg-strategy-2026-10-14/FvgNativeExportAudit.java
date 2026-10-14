import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.*;
import com.tradevault.repository.*;
import com.tradevault.service.*;
import com.tradevault.service.backtesting.ReplayCsvParser;
import org.apache.commons.csv.CSVFormat;
import org.springframework.mock.web.MockMultipartFile;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import static org.mockito.Mockito.*;

/** Local file audit with mocked persistence; does not connect to the deployed application. */
public class FvgNativeExportAudit {
    static ReplayCsvParser.Result parse(String path) throws Exception {
        try (var csv = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build()
                .parse(new java.io.StringReader(Files.readString(Path.of(path)).replace("\ufeff", "")))) {
            return ReplayCsvParser.parse(csv.getRecords(), csv.getHeaderNames(), "PEPPERSTONE:GER40F", null, Path.of(path).getFileName().toString());
        }
    }
    static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    public static void main(String[] args) throws Exception {
        var old = parse(args[0]);
        var fresh = parse(args[1]);
        require(old.errors().isEmpty() && fresh.errors().isEmpty(), "Native parse errors: " + fresh.errors());
        require(old.trades().size() == 523 && fresh.trades().size() == 523, "Expected 523 closed trades");
        var oldByKey = old.trades().stream().collect(Collectors.toMap(BacktestingTrade::getImportFingerprint, t -> t));
        require(fresh.trades().stream().allMatch(t -> oldByKey.containsKey(t.getImportFingerprint()) && t.isGapPresent()), "Execution identity or gap fact mismatch");
        try (var appCsv = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build()
                .parse(new java.io.StringReader(Files.readString(Path.of(args[2])).replace("\ufeff", "")))) {
            for (var row : appCsv) {
                var t = oldByKey.get(row.get("Import fingerprint"));
                require(t != null, "Existing app execution absent from source");
                t.setId(UUID.fromString(row.get("Trade ID")));
                t.setPlannedRR(row.get("Planned R:R").isBlank() ? null : new BigDecimal(row.get("Planned R:R")));
                t.setPnlR(row.get("Realized R").isBlank() ? null : new BigDecimal(row.get("Realized R")));
                t.setNotes(row.get("Notes"));
                t.setTagsJson(row.get("Tags (JSON)"));
            }
        }
        var mapper = new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        var before = old.trades().stream().map(t -> List.of(t.getId(), t.getNetPnl(), Objects.toString(t.getPnlR(), ""), Objects.toString(t.getPlannedRR(), ""), Objects.toString(t.getNotes(), ""), Objects.toString(t.getTagsJson(), ""))).toList();
        var workspaces = mock(BacktestingWorkspaceRepository.class);
        var repository = mock(BacktestingTradeRepository.class);
        var currentUser = mock(CurrentUserService.class);
        var user = User.builder().id(UUID.randomUUID()).build();
        var workspace = BacktestingWorkspace.builder().id(UUID.randomUUID()).symbol("PEPPERSTONE:GER40F").user(user).build();
        old.trades().forEach(t -> { t.setWorkspace(workspace); t.setUser(user); });
        when(currentUser.getCurrentUser()).thenReturn(user);
        when(workspaces.findByIdAndUser_Id(workspace.getId(), user.getId())).thenReturn(Optional.of(workspace));
        when(repository.findByWorkspace_IdAndUser_IdOrderByDateAscEntryTimeAscCreatedAtAsc(workspace.getId(), user.getId())).thenReturn(old.trades());
        var service = new BacktestingResearchService(workspaces, repository, null, null, currentUser, mapper, null, null);
        var file = new MockMultipartFile("file", Path.of(args[1]).getFileName().toString(), "text/csv", Files.readAllBytes(Path.of(args[1])));
        var preview = service.importCsv(workspace.getId(), file, null, null, true);
        require(preview.getInvalid() == 0 && preview.getImported() == 0 && preview.getDuplicates() == 523, "Preview counts");
        require(old.trades().stream().noneMatch(BacktestingTrade::isGapPresent), "Preview mutated gap annotations");
        var applied = service.importCsv(workspace.getId(), file, null, null, false);
        require(applied.getInvalid() == 0 && applied.getImported() == 0 && applied.getDuplicates() == 523, "Import counts");
        require(old.trades().stream().allMatch(BacktestingTrade::isGapPresent), "Missing hydrated gap facts");
        var after = old.trades().stream().map(t -> List.of(t.getId(), t.getNetPnl(), Objects.toString(t.getPnlR(), ""), Objects.toString(t.getPlannedRR(), ""), Objects.toString(t.getNotes(), ""), Objects.toString(t.getTagsJson(), ""))).toList();
        require(before.equals(after), "Research or execution values changed");
        var reimport = service.importCsv(workspace.getId(), file, null, null, true);
        require(reimport.getWarnings().stream().noneMatch(w -> w.contains("can be added")), "Enrichment is not idempotent");
        var responseRows = old.trades().stream().map(t -> org.springframework.test.util.ReflectionTestUtils.<Object>invokeMethod(service, "toTradeResponse", t, 0)).toList();
        mapper.writerWithDefaultPrettyPrinter().writeValue(Path.of(args[3], "hydrated-trades.json").toFile(), responseRows);
        var summary = new LinkedHashMap<String, Object>();
        summary.put("nativeClosedTrades", fresh.trades().size());
        summary.put("gapPresent", fresh.trades().stream().filter(BacktestingTrade::isGapPresent).count());
        summary.put("withExitFillMetrics", fresh.trades().stream().filter(t -> t.getExitSignal().contains("fillBars=")).count());
        summary.put("enrichedExistingExecutions", old.trades().size());
        summary.put("newExecutions", applied.getImported());
        summary.put("preservedIdsCashRNotesTags", before.equals(after));
        summary.put("previewReadOnly", true);
        summary.put("persistence", "MOCKED_LOCAL_ONLY");
        mapper.writerWithDefaultPrettyPrinter().writeValue(Path.of(args[3], "native-export-audit.json").toFile(), summary);
        System.out.println(mapper.writeValueAsString(summary));
    }
}
