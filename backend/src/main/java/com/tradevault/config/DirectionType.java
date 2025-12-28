package com.tradevault.config;

import com.tradevault.domain.enums.Direction;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;

/**
 * Custom converter for the Direction enum that maps to the PostgreSQL direction_type.
 */
@Converter
public class DirectionType implements AttributeConverter<Direction, String> {

    @Override
    public String convertToDatabaseColumn(Direction attribute) {
        if (attribute == null) {
            return null;
        }
        // Return the enum name as a string
        return attribute.name();
    }

    @Override
    public Direction convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        // Convert the database value to the enum
        return Direction.valueOf(dbData);
    }
}
