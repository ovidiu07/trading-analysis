package com.tradevault.service;

import com.tradevault.domain.entity.Trade;
import com.tradevault.domain.entity.User;
import com.tradevault.dto.trade.ImportResult;
import com.tradevault.repository.TradeRepository;
import com.tradevault.repository.spec.TradeSpecifications;
import com.tradevault.service.account.AccountScopeService;
import com.tradevault.service.account.AuthorizedAccountScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.data.jpa.domain.Specification;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ImportExportService {
    private final TradeRepository tradeRepository;
    private final CurrentUserService currentUserService;
    private final TradeCsvImportService tradeCsvImportService;
    private final AccountScopeService accountScopeService;

    public ImportResult importCsv(MultipartFile file) throws IOException {
        var summary = tradeCsvImportService.importCsv(file);
        return ImportResult.builder()
                .detectedFormat(summary.getDetectedFormat())
                .totalRows(summary.getTotalRows())
                .tradeGroups(summary.getTradeGroups())
                .imported(summary.getTradesCreated() + summary.getTradesUpdated())
                .updated(summary.getTradesUpdated())
                .failed(summary.getGroupsSkipped() + summary.getRowsSkipped())
                .groupResults(summary.getGroupResults())
                .build();
    }

    public String exportCsv(OffsetDateTime from, OffsetDateTime to) throws IOException {
        return exportCsv(from, to, null, null);
    }

    public String exportCsv(OffsetDateTime from, OffsetDateTime to,
                            String accountIds, String legacyAccountId) throws IOException {
        AuthorizedAccountScope accountScope = accountScopeService.resolve(accountIds, legacyAccountId);
        Specification<Trade> specification = Specification.where(TradeSpecifications.userId(accountScope.userId()));
        if (!accountScope.isAll()) {
            specification = specification.and(TradeSpecifications.accountIds(accountScope.accountIds()));
        }
        List<Trade> trades = tradeRepository.findAll(specification);
        StringBuilder sb = new StringBuilder();
        sb.append("# Account scope: ")
                .append(accountScope.isAll() ? "All accounts" : accountScope.accounts().size() + " selected accounts")
                .append('\n');
        for (var account : accountScope.accounts()) {
            sb.append("# Account: ").append(safeMetadata(account.getName())).append(" [").append(account.getId()).append("]\n");
        }
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

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String safeMetadata(String value) {
        return safe(value).replace('\r', ' ').replace('\n', ' ');
    }
}
