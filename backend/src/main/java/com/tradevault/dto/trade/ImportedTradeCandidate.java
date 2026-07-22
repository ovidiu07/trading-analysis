package com.tradevault.dto.trade;

import com.tradevault.domain.enums.Direction;
import com.tradevault.domain.enums.Market;
import com.tradevault.domain.enums.TradeStatus;
import com.tradevault.domain.enums.TradeSource;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class ImportedTradeCandidate {
    private TradeSource source;
    private String symbol;
    private Market market;
    private Direction direction;
    private TradeStatus status;
    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    private BigDecimal quantity;
    private BigDecimal entryPrice;
    private BigDecimal exitPrice;
    private BigDecimal stopLossPrice;
    private BigDecimal takeProfitPrice;
    private BigDecimal fees;
    private BigDecimal commission;
    private BigDecimal slippage;
    private String tradeCurrency;
    private String profileCurrency;
    private String accountId;
    private UUID accountRefId;
    private BigDecimal contractMultiplier;
    private String initialNotes;
}
