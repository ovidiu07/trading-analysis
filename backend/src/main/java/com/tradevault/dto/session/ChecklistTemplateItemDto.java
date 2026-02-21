package com.tradevault.dto.session;

import com.tradevault.domain.enums.ChecklistValueType;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ChecklistTemplateItemDto {
    String id;
    String text;
    Integer order;
    boolean required;
    boolean hasNote;
    String notePlaceholder;
    boolean hasValue;
    String valueLabel;
    ChecklistValueType valueType;
    boolean defaultChecked;
}
