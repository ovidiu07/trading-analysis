package com.tradevault.service;

import com.tradevault.domain.entity.User;
import com.tradevault.security.AuthenticatedUserResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CurrentUserService {
    private final AuthenticatedUserResolver authenticatedUserResolver;

    public User getCurrentUser() {
        return authenticatedUserResolver.getCurrentUser();
    }
}
