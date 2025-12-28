package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.dto.user.UserSettingsRequest;
import com.tradevault.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

public class UserServiceTest {

    private CurrentUserService currentUserService;
    private UserRepository userRepository;
    private UserService userService;
    private User user;

    @BeforeEach
    void setup() {
        currentUserService = mock(CurrentUserService.class);
        userRepository = mock(UserRepository.class);
        userService = new UserService(currentUserService, userRepository);
        user = User.builder()
                .id(UUID.randomUUID())
                .email("user@test.com")
                .baseCurrency("USD")
                .timezone("UTC")
                .build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
    }

    @Test
    void updatesSettingsForCurrentUser() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0, User.class));

        UserSettingsRequest request = new UserSettingsRequest();
        request.setBaseCurrency("EUR");
        request.setTimezone("Europe/Bucharest");

        var result = userService.updateSettings(request);

        assertEquals("EUR", result.getBaseCurrency());
        assertEquals("Europe/Bucharest", result.getTimezone());
        verify(userRepository, times(1)).save(any());
    }

    @Test
    void throwsWhenCurrentUserNotFound() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.empty());

        var request = new UserSettingsRequest();
        request.setBaseCurrency("USD");
        request.setTimezone("UTC");

        assertThrows(javax.persistence.EntityNotFoundException.class, () -> userService.updateSettings(request));
    }
}
