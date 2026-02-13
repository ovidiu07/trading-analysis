package com.tradevault.service;

import com.tradevault.dto.auth.UserDto;
import com.tradevault.dto.user.UserSettingsRequest;
import com.tradevault.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserService {
    private static final Set<String> ALLOWED_THEME_PREFERENCES = Set.of("LIGHT", "DARK", "SYSTEM");

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    public UserDto getCurrentUserProfile() {
        var user = currentUserService.getCurrentUser();
        var reloaded = userRepository.findById(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        return UserDto.from(reloaded);
    }

    @Transactional
    public UserDto updateSettings(UserSettingsRequest request) {
        var user = currentUserService.getCurrentUser();
        var entity = userRepository.findById(user.getId())
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        entity.setBaseCurrency(request.getBaseCurrency());
        entity.setTimezone(request.getTimezone());
        String themePreference = request.getThemePreference();
        if (themePreference == null || themePreference.isBlank()) {
            themePreference = entity.getThemePreference() == null ? "SYSTEM" : entity.getThemePreference();
        } else {
            themePreference = themePreference.trim().toUpperCase(Locale.ROOT);
        }
        if (!ALLOWED_THEME_PREFERENCES.contains(themePreference)) {
            throw new IllegalArgumentException("Theme preference must be LIGHT, DARK, or SYSTEM");
        }
        entity.setThemePreference(themePreference);
        userRepository.save(entity);
        return UserDto.from(entity);
    }
}
