package com.tradevault.dto.auth;

import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.Role;
import com.tradevault.security.CustomUserDetails;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserDtoRolesTest {
    @Test
    void superAdminUserDtoIncludesAdminAndSuperAdminRoles() {
        User user = User.builder()
                .email("super-admin@example.com")
                .role(Role.SUPER_ADMIN)
                .build();

        UserDto dto = UserDto.from(user);

        assertThat(dto.getRole()).isEqualTo(Role.SUPER_ADMIN);
        assertThat(dto.getRoles()).containsExactly(Role.ADMIN, Role.SUPER_ADMIN);
    }

    @Test
    void superAdminAuthoritiesIncludeAdminAndSuperAdmin() {
        User user = User.builder()
                .email("super-admin@example.com")
                .role(Role.SUPER_ADMIN)
                .build();

        CustomUserDetails details = new CustomUserDetails(user);

        assertThat(details.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_ADMIN", "ROLE_SUPER_ADMIN");
    }
}
