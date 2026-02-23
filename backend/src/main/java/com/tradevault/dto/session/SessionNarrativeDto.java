package com.tradevault.dto.session;

import com.tradevault.domain.enums.NarrativeConfirmationModel;
import com.tradevault.domain.enums.NarrativeDeliveryModel;
import com.tradevault.domain.enums.NarrativeHtfDraw;
import com.tradevault.domain.enums.NarrativeManipulation;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class SessionNarrativeDto {
    UUID sessionId;
    NarrativeHtfDraw htfDraw;
    NarrativeManipulation expectedManipulation;
    NarrativeDeliveryModel deliveryModel;
    NarrativeConfirmationModel confirmationModel;
    String notes;
    OffsetDateTime createdAtUtc;
    OffsetDateTime updatedAtUtc;
}
