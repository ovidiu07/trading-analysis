package com.tradevault.service;

import com.tradevault.domain.entity.Account;
import com.tradevault.domain.entity.NotebookFolder;
import com.tradevault.domain.entity.NotebookNote;
import com.tradevault.domain.entity.NotebookTag;
import com.tradevault.domain.entity.NotebookTagLink;
import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.NotebookNoteType;
import com.tradevault.domain.enums.NotebookTagEntityType;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.demo.DemoRemovalCount;
import com.tradevault.dto.demo.DemoRemovalResponse;
import com.tradevault.dto.demo.DemoStatusResponse;
import com.tradevault.repository.AccountRepository;
import com.tradevault.repository.NotebookAttachmentRepository;
import com.tradevault.repository.NotebookFolderRepository;
import com.tradevault.repository.NotebookNoteRepository;
import com.tradevault.repository.NotebookTagLinkRepository;
import com.tradevault.repository.NotebookTagRepository;
import com.tradevault.repository.NotebookTemplateRepository;
import com.tradevault.repository.TagRepository;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DemoDataService {
    private static final ZoneId DEMO_ZONE = ZoneId.of("Europe/Bucharest");
    private static final List<SymbolProfile> SYMBOL_PROFILES = List.of(
            new SymbolProfile("EURUSD", Market.FOREX, bd("1.0840"), bd("0.0006"), bd("10000"), 5),
            new SymbolProfile("GBPUSD", Market.FOREX, bd("1.2720"), bd("0.0008"), bd("10000"), 5),
            new SymbolProfile("NQ", Market.FUTURES, bd("17850"), bd("9"), bd("1"), 2),
            new SymbolProfile("AAPL", Market.STOCK, bd("187"), bd("0.9"), bd("40"), 2),
            new SymbolProfile("NVDA", Market.STOCK, bd("123"), bd("0.7"), bd("20"), 2),
            new SymbolProfile("QBTS", Market.STOCK, bd("2.90"), bd("0.06"), bd("250"), 4)
    );
    private static final List<String> TIMEFRAMES = List.of("5m", "15m", "1h", "4h", "1D");
    private static final List<String> STRATEGIES = List.of("Breakout", "Pullback", "Mean Reversion", "Trend Continuation");
    private static final List<String> SETUPS = List.of("Opening Range", "VWAP Reclaim", "Retest", "Trend Channel", "Range Fade");
    private static final List<String> CATALYSTS = List.of("Macro release", "Earnings", "Relative strength", "Volume spike", "Support/Resistance");
    private static final List<BigDecimal> OUTCOME_FACTORS = List.of(
            bd("1.7"), bd("-1.2"), bd("0.9"), bd("-0.6"), bd("2.2"), bd("-1.5"),
            bd("1.1"), bd("0.0"), bd("-0.8"), bd("1.4"), bd("-1.0"), bd("0.7")
    );

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TradeRepository tradeRepository;
    private final TagRepository tagRepository;
    private final NotebookFolderRepository notebookFolderRepository;
    private final NotebookNoteRepository notebookNoteRepository;
    private final NotebookTagRepository notebookTagRepository;
    private final NotebookTagLinkRepository notebookTagLinkRepository;
    private final NotebookAttachmentRepository notebookAttachmentRepository;
    private final NotebookTemplateRepository notebookTemplateRepository;

    @Transactional
    public void generateDemoDataForUser(UUID userId, boolean forceForBrandNewUser) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        if (!forceForBrandNewUser && !user.isDemoEnabled()) {
            return;
        }

        if (user.getDemoSeedId() != null || hasDemoDataInternal(userId)) {
            return;
        }

        if (!forceForBrandNewUser && hasRealData(userId)) {
            return;
        }

        UUID demoSeedId = UUID.randomUUID();
        LocalDate startDate = LocalDate.now(DEMO_ZONE).minusDays(42);

        Account demoAccount = Account.builder()
                .user(user)
                .name("Demo Multi-Asset")
                .broker("TradeJAudit Simulator")
                .accountCurrency(user.getBaseCurrency() == null || user.getBaseCurrency().isBlank() ? "USD" : user.getBaseCurrency())
                .startingBalance(bd("25000"))
                .createdAt(startDate.atTime(8, 0).atZone(DEMO_ZONE).toOffsetDateTime())
                .demoSeedId(demoSeedId)
                .build();
        demoAccount = accountRepository.save(demoAccount);

        List<Trade> trades = createDemoTrades(user, demoAccount, demoSeedId, startDate);
        List<Trade> savedTrades = tradeRepository.saveAll(trades);

        Map<String, NotebookFolder> folderByKey = ensureSystemFolders(user);
        List<NotebookTag> notebookTags = createNotebookTags(user, demoSeedId);
        notebookTags = notebookTagRepository.saveAll(notebookTags);

        List<NotebookNote> notes = createNotebookNotes(user, demoSeedId, startDate, folderByKey, savedTrades);
        notes = notebookNoteRepository.saveAll(notes);

        List<NotebookTagLink> links = createNotebookTagLinks(user, demoSeedId, notes, notebookTags);
        notebookTagLinkRepository.saveAll(links);

        user.setDemoEnabled(true);
        user.setDemoSeedId(demoSeedId);
        user.setDemoRemovedAt(null);
        userRepository.save(user);
    }

    @Transactional
    public void ensureDemoDataForLogin(UUID userId) {
        generateDemoDataForUser(userId, false);
    }

    @Transactional(readOnly = true)
    public DemoStatusResponse getDemoStatusForUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        boolean hasDemoData = hasDemoDataInternal(userId);
        boolean demoEnabled = user.isDemoEnabled() || hasDemoData;
        return new DemoStatusResponse(demoEnabled, hasDemoData);
    }

    @Transactional(readOnly = true)
    public boolean hasDemoData(UUID userId) {
        return hasDemoDataInternal(userId);
    }

    @Transactional
    public DemoRemovalResponse removeDemoDataForUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        long removedAttachments = notebookAttachmentRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedTagLinks = notebookTagLinkRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedNotes = notebookNoteRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedNotebookTags = notebookTagRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedTemplates = notebookTemplateRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedTrades = tradeRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedTags = tagRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedAccounts = accountRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);
        long removedFolders = notebookFolderRepository.deleteByUserIdAndDemoSeedIdIsNotNull(userId);

        user.setDemoEnabled(false);
        user.setDemoSeedId(null);
        if (user.getDemoRemovedAt() == null) {
            user.setDemoRemovedAt(OffsetDateTime.now());
        }
        userRepository.save(user);

        DemoRemovalCount removedCount = DemoRemovalCount.builder()
                .trades(removedTrades)
                .notes(removedNotes)
                .notebookTags(removedNotebookTags)
                .notebookTagLinks(removedTagLinks)
                .notebookAttachments(removedAttachments)
                .tags(removedTags)
                .accounts(removedAccounts)
                .notebookTemplates(removedTemplates)
                .notebookFolders(removedFolders)
                .build();

        return new DemoRemovalResponse(false, removedCount);
    }

    private List<Trade> createDemoTrades(User user, Account account, UUID demoSeedId, LocalDate startDate) {
        List<Trade> trades = new ArrayList<>();

        for (int i = 0; i < 48; i++) {
            SymbolProfile profile = SYMBOL_PROFILES.get(i % SYMBOL_PROFILES.size());
            Direction direction = i % 2 == 0 ? Direction.LONG : Direction.SHORT;
            TradeStatus status = i % 6 == 0 ? TradeStatus.OPEN : TradeStatus.CLOSED;

            int dayOffset = i % 42;
            OffsetDateTime openedAt = startDate
                    .plusDays(dayOffset)
                    .atTime(8 + (i % 8), 5 + ((i * 11) % 50))
                    .atZone(DEMO_ZONE)
                    .toOffsetDateTime();

            BigDecimal entryPrice = profile.basePrice()
                    .add(profile.step().multiply(BigDecimal.valueOf((i % 5) - 2L)))
                    .setScale(profile.scale(), RoundingMode.HALF_UP);

            BigDecimal outcomeFactor = OUTCOME_FACTORS.get(i % OUTCOME_FACTORS.size());
            boolean forceFlat = status == TradeStatus.CLOSED && i % 13 == 0;
            if (forceFlat) {
                outcomeFactor = BigDecimal.ZERO;
            }

            BigDecimal movement = profile.step()
                    .multiply(outcomeFactor.abs().add(bd("0.5")))
                    .setScale(profile.scale(), RoundingMode.HALF_UP);
            BigDecimal signedMove;
            if (outcomeFactor.compareTo(BigDecimal.ZERO) == 0) {
                signedMove = BigDecimal.ZERO;
            } else {
                boolean positive = outcomeFactor.signum() > 0;
                if (direction == Direction.LONG) {
                    signedMove = positive ? movement : movement.negate();
                } else {
                    signedMove = positive ? movement.negate() : movement;
                }
            }

            BigDecimal exitPrice = status == TradeStatus.CLOSED
                    ? entryPrice.add(signedMove).setScale(profile.scale(), RoundingMode.HALF_UP)
                    : null;

            BigDecimal fees = status == TradeStatus.CLOSED
                    ? bd("0.35").add(BigDecimal.valueOf(i % 3L).multiply(bd("0.07"))).setScale(4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
            BigDecimal commission = status == TradeStatus.CLOSED
                    ? bd("0.45").add(BigDecimal.valueOf(i % 2L).multiply(bd("0.06"))).setScale(4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
            BigDecimal slippage = status == TradeStatus.CLOSED
                    ? BigDecimal.valueOf(i % 4L).multiply(bd("0.03")).setScale(4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);

            if (forceFlat) {
                fees = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
                commission = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
                slippage = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
            }

            BigDecimal quantity = profile.quantity().setScale(4, RoundingMode.HALF_UP);
            BigDecimal capitalUsed = entryPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
            BigDecimal riskAmount = capitalUsed
                    .multiply(bd("0.008").add(BigDecimal.valueOf(i % 4L).multiply(bd("0.002"))))
                    .setScale(4, RoundingMode.HALF_UP);
            BigDecimal riskPercent = capitalUsed.compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP)
                    : riskAmount.divide(capitalUsed, 4, RoundingMode.HALF_UP).multiply(bd("100")).setScale(4, RoundingMode.HALF_UP);

            BigDecimal pnlGross = null;
            BigDecimal pnlNet = null;
            BigDecimal pnlPercent = null;
            BigDecimal rMultiple = null;
            OffsetDateTime closedAt = null;

            if (status == TradeStatus.CLOSED && exitPrice != null) {
                closedAt = openedAt.plusMinutes(35L + ((i % 7L) * 19L));
                BigDecimal priceDiff = direction == Direction.LONG
                        ? exitPrice.subtract(entryPrice)
                        : entryPrice.subtract(exitPrice);
                pnlGross = priceDiff.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
                pnlNet = pnlGross.subtract(fees).subtract(commission).subtract(slippage).setScale(4, RoundingMode.HALF_UP);
                if (riskAmount.compareTo(BigDecimal.ZERO) != 0) {
                    pnlPercent = pnlNet.divide(riskAmount, 4, RoundingMode.HALF_UP).multiply(bd("100")).setScale(4, RoundingMode.HALF_UP);
                    rMultiple = pnlNet.divide(riskAmount, 4, RoundingMode.HALF_UP);
                }
            }

            BigDecimal stopLossPrice = direction == Direction.LONG
                    ? entryPrice.subtract(profile.step().multiply(bd("2.2")))
                    : entryPrice.add(profile.step().multiply(bd("2.2")));
            BigDecimal takeProfitPrice = direction == Direction.LONG
                    ? entryPrice.add(profile.step().multiply(bd("3.4")))
                    : entryPrice.subtract(profile.step().multiply(bd("3.4")));

            Trade trade = Trade.builder()
                    .user(user)
                    .account(account)
                    .symbol(profile.symbol())
                    .market(profile.market())
                    .direction(direction)
                    .status(status)
                    .openedAt(openedAt)
                    .closedAt(closedAt)
                    .timeframe(TIMEFRAMES.get(i % TIMEFRAMES.size()))
                    .quantity(quantity)
                    .entryPrice(entryPrice)
                    .exitPrice(exitPrice)
                    .stopLossPrice(stopLossPrice.setScale(profile.scale(), RoundingMode.HALF_UP))
                    .takeProfitPrice(takeProfitPrice.setScale(profile.scale(), RoundingMode.HALF_UP))
                    .fees(fees)
                    .commission(commission)
                    .slippage(slippage)
                    .pnlGross(pnlGross)
                    .pnlNet(pnlNet)
                    .pnlPercent(pnlPercent)
                    .riskAmount(riskAmount)
                    .riskPercent(riskPercent)
                    .rMultiple(rMultiple)
                    .capitalUsed(capitalUsed)
                    .setup(SETUPS.get(i % SETUPS.size()))
                    .strategyTag(STRATEGIES.get(i % STRATEGIES.size()))
                    .catalystTag(CATALYSTS.get(i % CATALYSTS.size()))
                    .notes("Demo trade #" + (i + 1) + " generated for onboarding.")
                    .createdAt(openedAt.minusMinutes(8))
                    .updatedAt((status == TradeStatus.CLOSED && closedAt != null) ? closedAt.plusMinutes(3) : openedAt.plusMinutes(20))
                    .demoSeedId(demoSeedId)
                    .build();
            trades.add(trade);
        }

        return trades;
    }

    private List<NotebookTag> createNotebookTags(User user, UUID demoSeedId) {
        return List.of(
                NotebookTag.builder().user(user).name("Risk").color("#ef5350").demoSeedId(demoSeedId).build(),
                NotebookTag.builder().user(user).name("Execution").color("#42a5f5").demoSeedId(demoSeedId).build(),
                NotebookTag.builder().user(user).name("Review").color("#66bb6a").demoSeedId(demoSeedId).build(),
                NotebookTag.builder().user(user).name("Psychology").color("#ffa726").demoSeedId(demoSeedId).build(),
                NotebookTag.builder().user(user).name("Playbook").color("#ab47bc").demoSeedId(demoSeedId).build()
        );
    }

    private List<NotebookNote> createNotebookNotes(User user,
                                                   UUID demoSeedId,
                                                   LocalDate startDate,
                                                   Map<String, NotebookFolder> folderByKey,
                                                   List<Trade> trades) {
        Trade referenceTrade = trades.stream()
                .filter(trade -> trade.getStatus() == TradeStatus.CLOSED)
                .findFirst()
                .orElse(null);

        List<NotebookNote> notes = new ArrayList<>();
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_PLANS_GOALS),
                NotebookNoteType.PLAN,
                "Weekly Trade Plan (Demo)",
                "<p>Focus on A+ setups only and cap risk at 1% per trade.</p><ul><li>Trade only during planned sessions</li><li>Skip revenge entries</li><li>Journal every close</li></ul>",
                startDate.plusDays(1),
                null,
                demoSeedId,
                9,
                10
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_PLANS_GOALS),
                NotebookNoteType.GOAL,
                "Monthly Goal (Demo)",
                "<p>Primary objective: consistent execution over outcome.</p><p>Secondary objective: maintain max daily drawdown below 2R.</p>",
                startDate.plusDays(3),
                null,
                demoSeedId,
                10,
                35
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_DAILY_JOURNAL),
                NotebookNoteType.DAILY_LOG,
                "London Session Checklist",
                "<p>Checklist:</p><ul><li>Mark key levels before open</li><li>Wait for confirmation candle</li><li>Log emotions after each trade</li></ul>",
                startDate.plusDays(6),
                null,
                demoSeedId,
                7,
                45
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_TRADE_NOTES),
                NotebookNoteType.TRADE_NOTE,
                "NQ Breakout Review",
                "<p>Entry followed plan. Exit was slightly rushed near first resistance.</p><p>Action item: partial out only after structure break.</p>",
                startDate.plusDays(10),
                referenceTrade,
                demoSeedId,
                15,
                20
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_SESSIONS_RECAP),
                NotebookNoteType.SESSION_RECAP,
                "Friday Recap",
                "<p>Strong discipline on losers, but under-sized best setup.</p><p>Next week: predefine size tiers by setup quality.</p>",
                startDate.plusDays(14),
                null,
                demoSeedId,
                18,
                10
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_DAILY_JOURNAL),
                NotebookNoteType.NOTE,
                "Risk Rules",
                "<p>Never increase size after two consecutive losses.</p><p>Pause trading for 30 minutes after any emotional trigger.</p>",
                startDate.plusDays(18),
                null,
                demoSeedId,
                8,
                25
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_TRADE_NOTES),
                NotebookNoteType.TRADE_NOTE,
                "AAPL Pullback Notes",
                "<p>Good location entry and clean stop placement.</p><p>Need better patience on profit targets.</p>",
                startDate.plusDays(23),
                referenceTrade,
                demoSeedId,
                14,
                40
        ));
        notes.add(buildNote(
                user,
                folderByKey.get(NotebookFolderService.SYSTEM_SESSIONS_RECAP),
                NotebookNoteType.SESSION_RECAP,
                "Weekly Reflection",
                "<p>Win rate improved on setups with pre-market plan.</p><p>Keep reducing low-quality afternoon trades.</p>",
                startDate.plusDays(28),
                null,
                demoSeedId,
                16,
                5
        ));
        return notes;
    }

    private List<NotebookTagLink> createNotebookTagLinks(User user,
                                                         UUID demoSeedId,
                                                         List<NotebookNote> notes,
                                                         List<NotebookTag> tags) {
        if (notes.isEmpty() || tags.isEmpty()) {
            return List.of();
        }

        List<NotebookTagLink> links = new ArrayList<>();
        for (int i = 0; i < notes.size(); i++) {
            NotebookNote note = notes.get(i);
            NotebookTag primary = tags.get(i % tags.size());
            NotebookTag secondary = tags.get((i + 2) % tags.size());

            links.add(NotebookTagLink.builder()
                    .user(user)
                    .tag(primary)
                    .note(note)
                    .entityType(NotebookTagEntityType.NOTE)
                    .demoSeedId(demoSeedId)
                    .build());

            if (!Objects.equals(primary.getId(), secondary.getId())) {
                links.add(NotebookTagLink.builder()
                        .user(user)
                        .tag(secondary)
                        .note(note)
                        .entityType(NotebookTagEntityType.NOTE)
                        .demoSeedId(demoSeedId)
                        .build());
            }
        }

        return links;
    }

    private NotebookNote buildNote(User user,
                                   NotebookFolder folder,
                                   NotebookNoteType type,
                                   String title,
                                   String body,
                                   LocalDate dateKey,
                                   Trade relatedTrade,
                                   UUID demoSeedId,
                                   int hour,
                                   int minute) {
        OffsetDateTime createdAt = dateKey.atTime(hour, minute).atZone(DEMO_ZONE).toOffsetDateTime();
        return NotebookNote.builder()
                .user(user)
                .type(type)
                .folder(folder)
                .title(title)
                .body(body)
                .bodyJson(null)
                .dateKey(dateKey)
                .relatedTrade(relatedTrade)
                .isDeleted(false)
                .deletedAt(null)
                .isPinned(type == NotebookNoteType.PLAN || type == NotebookNoteType.GOAL)
                .createdAt(createdAt)
                .updatedAt(createdAt.plusMinutes(5))
                .demoSeedId(demoSeedId)
                .build();
    }

    private Map<String, NotebookFolder> ensureSystemFolders(User user) {
        Map<String, String> systemFolders = new LinkedHashMap<>();
        systemFolders.put(NotebookFolderService.SYSTEM_ALL_NOTES, "All notes");
        systemFolders.put(NotebookFolderService.SYSTEM_DAILY_JOURNAL, "Daily journal");
        systemFolders.put(NotebookFolderService.SYSTEM_TRADE_NOTES, "Trade notes");
        systemFolders.put(NotebookFolderService.SYSTEM_PLANS_GOALS, "Plans & goals");
        systemFolders.put(NotebookFolderService.SYSTEM_SESSIONS_RECAP, "Sessions recap");
        systemFolders.put(NotebookFolderService.SYSTEM_RECENTLY_DELETED, "Recently deleted");

        Map<String, NotebookFolder> result = new LinkedHashMap<>();
        int sortOrder = 0;
        for (var entry : systemFolders.entrySet()) {
            String key = entry.getKey();
            int currentSortOrder = sortOrder;
            NotebookFolder folder = notebookFolderRepository.findByUserIdAndSystemKey(user.getId(), key)
                    .orElseGet(() -> notebookFolderRepository.save(NotebookFolder.builder()
                            .user(user)
                            .name(entry.getValue())
                            .systemKey(key)
                            .sortOrder(currentSortOrder)
                            .build()));
            result.put(key, folder);
            sortOrder++;
        }
        return result;
    }

    private boolean hasRealData(UUID userId) {
        return tradeRepository.existsByUserIdAndDemoSeedIdIsNull(userId)
                || notebookNoteRepository.existsByUserIdAndDemoSeedIdIsNull(userId);
    }

    private boolean hasDemoDataInternal(UUID userId) {
        return tradeRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || notebookNoteRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || notebookTagRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || notebookTagLinkRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || notebookAttachmentRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || notebookTemplateRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || notebookFolderRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || accountRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId)
                || tagRepository.existsByUserIdAndDemoSeedIdIsNotNull(userId);
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    private record SymbolProfile(
            String symbol,
            Market market,
            BigDecimal basePrice,
            BigDecimal step,
            BigDecimal quantity,
            int scale
    ) {}
}
