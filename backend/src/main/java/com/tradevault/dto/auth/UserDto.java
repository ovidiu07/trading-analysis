package com.tradevault.dto.auth;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
public class UserDto {
    private UUID id;
    private String email;
    private Role role;
    private String timezone;
    private String baseCurrency;
    private String themePreference;
    private List<Role> roles;

    public static UserDto from(User user) {
        return new UserDto(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                user.getTimezone(),
                user.getBaseCurrency(),
                user.getThemePreference(),
                rolesFor(user.getRole())
        );
    }

    private static List<Role> rolesFor(Role role) {
        if (role == Role.SUPER_ADMIN) {
            return List.of(Role.ADMIN, Role.SUPER_ADMIN);
        }
        return List.of(role);
    }
}
