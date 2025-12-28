package com.tradevault.service;

import com.tradevault.dto.auth.UserDto;
import com.tradevault.dto.user.UserSettingsRequest;
import com.tradevault.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
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
        userRepository.save(entity);
        return UserDto.from(entity);
    }
}
