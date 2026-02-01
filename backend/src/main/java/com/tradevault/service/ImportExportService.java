package com.tradevault.service;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.dto.trade.ImportResult;
import com.tradevault.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ImportExportService {
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;

    public ImportResult importCsv(MultipartFile file) throws IOException {
        User user = currentUserService.getCurrentUser();
        int imported = 0;
        int failed = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()));
             CSVParser parser = new CSVParser(reader, CSVFormat.DEFAULT.withFirstRecordAsHeader())) {
            for (CSVRecord record : parser) {
                try {
                    Trade trade = mapRecord(record, user);
                    tradeRepository.save(trade);
                    imported++;
                } catch (Exception ex) {
                    failed++;
                }
            }
        }
        return ImportResult.builder().imported(imported).failed(failed).build();
    }

    public String exportCsv(OffsetDateTime from, OffsetDateTime to) throws IOException {
        User user = currentUserService.getCurrentUser();
        List<Trade> trades = tradeRepository.findByUserId(user.getId());
        StringBuilder sb = new StringBuilder();
        sb.append("symbol,market,direction,openedAt,closedAt,quantity,entryPrice,exitPrice,fees,commission,slippage,stopLossPrice,takeProfitPrice,setup,strategyTag,catalystTag,notes\n");
        for (Trade trade : trades) {
            if ((from != null && trade.getOpenedAt().isBefore(from)) || (to != null && trade.getOpenedAt().isAfter(to))) {
                continue;
            }
            sb.append(trade.getSymbol()).append(',')
                    .append(trade.getMarket()).append(',')
                    .append(trade.getDirection()).append(',')
                    .append(trade.getOpenedAt()).append(',')
                    .append(trade.getClosedAt()).append(',')
                    .append(trade.getQuantity()).append(',')
                    .append(trade.getEntryPrice()).append(',')
                    .append(trade.getExitPrice()).append(',')
                    .append(trade.getFees()).append(',')
                    .append(trade.getCommission()).append(',')
                    .append(trade.getSlippage()).append(',')
                    .append(trade.getStopLossPrice()).append(',')
                    .append(trade.getTakeProfitPrice()).append(',')
                    .append(safe(trade.getSetup())).append(',')
                    .append(safe(trade.getStrategyTag())).append(',')
                    .append(safe(trade.getCatalystTag())).append(',')
                    .append(safe(trade.getNotes()))
                    .append("\n");
        }
        return sb.toString();
    }

    private Trade mapRecord(CSVRecord record, User user) {
        Trade trade = new Trade();
        trade.setUser(user);
        trade.setSymbol(record.get("symbol"));
        trade.setMarket(Market.valueOf(record.get("market").toUpperCase()));
        trade.setDirection(Direction.valueOf(record.get("direction").toUpperCase()));
        trade.setOpenedAt(parseDate(record.get("openedAt")));
        trade.setClosedAt(parseDate(record.get("closedAt")));
        trade.setQuantity(new BigDecimal(record.get("quantity")));
        trade.setEntryPrice(new BigDecimal(record.get("entryPrice")));
        trade.setExitPrice(parseDecimal(record.get("exitPrice")));
        trade.setFees(parseDecimal(record.get("fees")));
        trade.setCommission(parseDecimal(record.get("commission")));
        trade.setSlippage(parseDecimal(record.get("slippage")));
        trade.setStopLossPrice(parseDecimal(record.get("stopLossPrice")));
        trade.setTakeProfitPrice(parseDecimal(record.get("takeProfitPrice")));
        trade.setSetup(record.get("setup"));
        trade.setStrategyTag(record.get("strategyTag"));
        trade.setCatalystTag(record.get("catalystTag"));
        trade.setNotes(record.get("notes"));
        trade.setStatus(trade.getClosedAt() != null ? TradeStatus.CLOSED : TradeStatus.OPEN);
        trade.setCreatedAt(OffsetDateTime.now());
        trade.setUpdatedAt(trade.getCreatedAt());
        return trade;
    }

    private OffsetDateTime parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        return OffsetDateTime.parse(value);
    }

    private BigDecimal parseDecimal(String value) {
        if (value == null || value.isBlank()) return null;
        return new BigDecimal(value);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
