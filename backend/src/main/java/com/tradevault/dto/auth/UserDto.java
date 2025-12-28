package com.tradevault.dto.auth;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class UserDto {
    private UUID id;
    private String email;
    private Role role;
    private String timezone;
    private String baseCurrency;

    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getEmail(), user.getRole(), user.getTimezone(), user.getBaseCurrency());
    }
}
