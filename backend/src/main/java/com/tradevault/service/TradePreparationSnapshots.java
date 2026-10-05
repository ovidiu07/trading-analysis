package com.tradevault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.domain.entity.SessionSetup;
import com.tradevault.domain.entity.Trade;
import com.tradevault.dto.trade.TradeRequest;

/** User-recorded entry evidence, independent of future session/strategy edits. */
public final class TradePreparationSnapshots {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();
    private TradePreparationSnapshots() {}

    public static JsonNode capture(TradeRequest request, Trade trade, SessionSetup setup) {
        JsonNode source = setup == null ? request.getPreparationSnapshot()
                : setup.getContextSnapshotJson().path("preparationSnapshot");
        if (setup == null && (source == null || source.isNull())) return null;
        ObjectNode snapshot = MAPPER.createObjectNode();
        if (source != null && !source.isNull() && !source.isMissingNode()) {
            if (!source.isObject() || source.toString().length() > 200_000)
                throw new IllegalArgumentException("Invalid preparation snapshot");
            String accountId = source.path("accountId").asText();
            if (trade.getAccount() == null || !trade.getAccount().getId().toString().equals(accountId))
                throw new IllegalArgumentException("Preparation account must match the trade");
            snapshot = source.deepCopy();
        }
        snapshot.put("version", 1);
        snapshot.put("source", "USER_RECORDED");
        snapshot.put("capturedAt", trade.getCreatedAt().toString());
        snapshot.put("accountId", trade.getAccount() == null ? null : trade.getAccount().getId().toString());
        if (setup != null) {
            ObjectNode config = snapshot.putObject("setupConfiguration");
            config.put("setupId", setup.getId().toString());
            config.put("sessionId", setup.getTodaySession().getId().toString());
            config.put("symbol", setup.getSymbol());
            config.put("direction", setup.getDirection() == null ? null : setup.getDirection().name());
            config.put("title", setup.getSetupTitle());
            config.put("biasAlignment", setup.getBiasAlignment());
            config.put("manualSetupMode", setup.getManualSetupMode());
            ObjectNode context = setup.getContextSnapshotJson().deepCopy();
            context.remove("preparationSnapshot");
            config.set("context", context);
            config.set("strategy", copy(setup.getStrategySnapshotJson()));
            config.set("trigger", copy(setup.getTriggerSnapshotJson()));
            config.set("executions", copy(setup.getExecutionSnapshotJson()));
            config.set("review", copy(setup.getReviewSnapshotJson()));
            config.set("levels", copy(setup.getLevelsJson()));
            config.set("confluences", copy(setup.getConfluencesJson()));
            config.set("mentorReference", copy(setup.getMentorReferenceJson()));
            config.set("narrative", copy(setup.getNarrativeSnapshotJson()));
            var day = setup.getTodaySession();
            ObjectNode session = snapshot.putObject("sessionConfiguration");
            session.set("sessionDate", MAPPER.valueToTree(day.getSessionDate()));
            session.set("profitTarget", MAPPER.valueToTree(day.getProfitTarget()));
            session.set("lossLimit", MAPPER.valueToTree(day.getLossLimit()));
            session.set("riskPerTrade", MAPPER.valueToTree(day.getRiskPerTrade()));
            session.set("maxTrades", MAPPER.valueToTree(day.getMaxTrades()));
            session.set("maxConsecutiveLosses", MAPPER.valueToTree(day.getMaxConsecutiveLosses()));
            session.set("stopAfterTargetReached", MAPPER.valueToTree(day.getStopAfterTargetReached()));
            session.set("stopAfterMaxLossReached", MAPPER.valueToTree(day.getStopAfterMaxLossReached()));
            session.set("plannedTickersJson", MAPPER.valueToTree(day.getPlannedTickersJson()));
            session.set("checklistStateJson", MAPPER.valueToTree(day.getChecklistStateJson()));
            session.set("prereqsStateJson", MAPPER.valueToTree(day.getPrereqsStateJson()));
            session.set("triggersStateJson", MAPPER.valueToTree(day.getTriggersStateJson()));
            session.set("lockInSession", MAPPER.valueToTree(day.getLockInSession()));
            session.set("lockInObjective", MAPPER.valueToTree(day.getLockInObjective()));
            session.set("lockInBias", MAPPER.valueToTree(day.getLockInBias()));
            session.set("lockInBiasReason", MAPPER.valueToTree(day.getLockInBiasReason()));
            session.set("lockInAt", MAPPER.valueToTree(day.getLockInAt()));
            session.set("activePlaybookSnapshotJson", MAPPER.valueToTree(day.getActivePlaybookSnapshotJson()));

        }
        ObjectNode logged = MAPPER.valueToTree(request);
        logged.remove("preparationSnapshot");
        snapshot.set("loggedTrade", logged);
        return snapshot;
    }
    private static JsonNode copy(JsonNode node) { return node == null ? MAPPER.nullNode() : node.deepCopy(); }
}
