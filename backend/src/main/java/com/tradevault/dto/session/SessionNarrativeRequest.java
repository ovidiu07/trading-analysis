package com.tradevault.dto.session;

import com.tradevault.domain.enums.NarrativeConfirmationModel;
import com.tradevault.domain.enums.NarrativeDeliveryModel;
import com.tradevault.domain.enums.NarrativeHtfDraw;
import com.tradevault.domain.enums.NarrativeManipulation;
import lombok.Data;

@Data
public class SessionNarrativeRequest {
    private NarrativeHtfDraw htfDraw;
    private NarrativeManipulation expectedManipulation;
    private NarrativeDeliveryModel deliveryModel;
    private NarrativeConfirmationModel confirmationModel;
    private String notes;
}
