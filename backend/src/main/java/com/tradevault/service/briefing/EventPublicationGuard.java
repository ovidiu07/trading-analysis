package com.tradevault.service.briefing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;

/** Read-time defence for older stored documents; never modifies immutable database payloads. */
public final class EventPublicationGuard {
    private EventPublicationGuard() {}
    public static JsonNode safeCopy(JsonNode document,Instant now) {JsonNode copy=document.deepCopy();visit(copy,now);return copy;}
    private static void visit(JsonNode node,Instant now) {
        if(node.isObject() && node.has("translations")) {
            Instant reference=parse(node.path("referenceTime"));
            Instant cutoff=reference!=null && reference.isBefore(now)?reference:now;
            for(var translation:node.path("translations"))for(var raw:translation.path("events"))if(raw instanceof ObjectNode event) {
                Instant published=parse(event.path("publishedAt"));Instant scheduled=parse(event.path("scheduledAt"));
                Instant retrieved=parse(event.path("official").path("retrievedAt"));
                Instant resultRetrieved=parse(event.path("official").path("resultRetrievedAt"));
                if(!"RELEASED".equals(event.path("status").asText()) || published==null || published.isAfter(cutoff)
                    || scheduled!=null && scheduled.isAfter(cutoff) || retrieved!=null && retrieved.isAfter(cutoff) || resultRetrieved!=null && resultRetrieved.isAfter(cutoff))event.putNull("actual");
                if(event.path("forecastSourceUrl").asText("").isBlank())event.putNull("forecast");
                if(event.path("previousSourceUrl").asText("").isBlank())event.putNull("previous");
            }
        }
        if(node.isContainerNode())for(var child:node)visit(child,now);
    }
    private static Instant parse(JsonNode node){try{return Instant.parse(node.asText());}catch(Exception e){return null;}}
}
