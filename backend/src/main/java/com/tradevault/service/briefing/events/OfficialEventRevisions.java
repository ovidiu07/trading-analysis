package com.tradevault.service.briefing.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tradevault.service.briefing.BriefingDocument.EventStatus;
import java.util.Objects;

public final class OfficialEventRevisions {
    private OfficialEventRevisions() {}
    public static boolean older(OfficialEvent old,OfficialEvent next) {
        if(old.sourceSequence()!=null && next.sourceSequence()!=null && next.sourceSequence()<old.sourceSequence())return true;
        return old.sourceModifiedAt()!=null && next.sourceModifiedAt()!=null && next.sourceModifiedAt().isBefore(old.sourceModifiedAt())
            && (old.sourceSequence()==null || next.sourceSequence()==null || next.sourceSequence()<=old.sourceSequence());
    }
    public static OfficialEvent calendar(OfficialEvent old,OfficialEvent next) {
        if(old==null)return next;
        boolean moved=!Objects.equals(old.scheduledAt(),next.scheduledAt()) || !Objects.equals(old.scheduledDate(),next.scheduledDate());
        boolean cancel=next.status()==EventStatus.CANCELLED;
        boolean retain=!moved && !cancel && old.status()!=EventStatus.CANCELLED;
        EventStatus status=cancel?EventStatus.CANCELLED:moved?EventStatus.RESCHEDULED:retain?old.status():next.status();
        return new OfficialEvent(next.sourceId(),next.eventId(),next.sourceEventId(),next.identityBasis(),next.region(),next.name(),next.scheduledAt(),next.scheduledDate(),
            next.sourceTimezone(),next.sourceUrl(),next.retrievedAt(),status,next.sourceSequence(),next.sourceModifiedAt(),
            moved?old.scheduledAt():old.previousScheduledAt(),moved?old.scheduledDate():old.previousScheduledDate(),
            retain?old.actual():null,retain?old.unit():null,retain?old.publishedAt():null,retain?old.publicationSourceUrl():null,
            retain?old.resultSourceUrl():null,retain?old.seriesId():null,retain?old.referencePeriod():null,retain?old.measure():null,
            retain && old.actual()!=null?old.notes():next.notes(),retain?old.resultRetrievedAt():null);
    }
    public static String fingerprint(ObjectMapper mapper,OfficialEvent event) {
        ObjectNode json=mapper.valueToTree(event);json.remove("retrievedAt");json.remove("resultRetrievedAt");
        if("SCHEDULE_SIGNATURE".equals(event.identityBasis()))json.remove("sourceEventId");
        try {return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
}
