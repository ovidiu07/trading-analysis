package com.tradevault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradevault.domain.entity.ChartProfile;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.ChartProfileScope;
import com.tradevault.dto.chartprofile.ChartProfileRequest;
import com.tradevault.dto.chartprofile.ChartProfileUpdateRequest;
import com.tradevault.repository.ChartProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ChartProfileServiceTest {

    private ChartProfileRepository chartProfileRepository;
    private CurrentUserService currentUserService;
    private ChartProfileService chartProfileService;
    private ObjectMapper objectMapper;
    private User user;

    @BeforeEach
    void setup() {
        chartProfileRepository = mock(ChartProfileRepository.class);
        currentUserService = mock(CurrentUserService.class);
        objectMapper = new ObjectMapper();
        chartProfileService = new ChartProfileService(chartProfileRepository, currentUserService, objectMapper);
        user = User.builder().id(UUID.randomUUID()).email("chart@test.com").build();
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(chartProfileRepository.save(any(ChartProfile.class))).thenAnswer(invocation -> {
            ChartProfile profile = invocation.getArgument(0, ChartProfile.class);
            if (profile.getId() == null) {
                profile.setId(UUID.randomUUID());
            }
            return profile;
        });
    }

    @Test
    void createProfileWithDefaultClearsOtherDefault() {
        ChartProfile existingDefault = ChartProfile.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Existing")
                .scope(ChartProfileScope.SESSION_MODE)
                .isDefault(true)
                .embedConfigJson(objectMapper.createObjectNode())
                .tjaPrefsJson(objectMapper.createObjectNode())
                .build();
        when(chartProfileRepository.findByUser_IdAndScopeAndIsDefaultTrue(user.getId(), ChartProfileScope.SESSION_MODE))
                .thenReturn(List.of(existingDefault));

        ChartProfileRequest request = new ChartProfileRequest();
        request.setName("London profile");
        request.setScope(ChartProfileScope.SESSION_MODE);
        request.setIsDefault(true);
        request.setEmbedConfigJson(objectMapper.createObjectNode().put("symbol", "OANDA:EURUSD").put("interval", "15"));
        request.setTjaPrefsJson(objectMapper.createObjectNode().put("showLevels", true));

        var response = chartProfileService.createProfile(request);

        assertThat(response.isDefault()).isTrue();
        assertThat(response.getName()).isEqualTo("London profile");
        assertThat(response.getEmbedConfigJson().path("symbol").asText()).isEqualTo("OANDA:EURUSD");
        assertThat(existingDefault.isDefault()).isFalse();
        verify(chartProfileRepository).saveAll(argThat(items -> {
            List<ChartProfile> list = StreamSupport.stream(items.spliterator(), false).toList();
            return list.size() == 1 && list.get(0).getId().equals(existingDefault.getId()) && !list.get(0).isDefault();
        }));
    }

    @Test
    void updateProfileRenamesAndUpdatesConfig() {
        UUID profileId = UUID.randomUUID();
        ChartProfile profile = ChartProfile.builder()
                .id(profileId)
                .user(user)
                .name("Old name")
                .scope(ChartProfileScope.SESSION_MODE)
                .isDefault(false)
                .embedConfigJson(objectMapper.createObjectNode().put("symbol", "OANDA:EURUSD"))
                .tjaPrefsJson(objectMapper.createObjectNode())
                .build();
        when(chartProfileRepository.findByIdAndUser_Id(profileId, user.getId())).thenReturn(Optional.of(profile));

        ChartProfileUpdateRequest request = new ChartProfileUpdateRequest();
        request.setName("Renamed");
        request.setEmbedConfigJson(objectMapper.createObjectNode().put("symbol", "OANDA:GBPUSD").put("interval", "5"));

        var response = chartProfileService.updateProfile(profileId, request);

        assertThat(response.getName()).isEqualTo("Renamed");
        assertThat(response.getEmbedConfigJson().path("symbol").asText()).isEqualTo("OANDA:GBPUSD");
        assertThat(response.getEmbedConfigJson().path("interval").asText()).isEqualTo("5");
    }

    @Test
    void setDefaultMarksOnlyTargetProfileAsDefault() {
        UUID targetId = UUID.randomUUID();
        ChartProfile target = ChartProfile.builder()
                .id(targetId)
                .user(user)
                .name("Target")
                .scope(ChartProfileScope.SESSION_MODE)
                .isDefault(false)
                .embedConfigJson(objectMapper.createObjectNode())
                .tjaPrefsJson(objectMapper.createObjectNode())
                .build();

        ChartProfile otherDefault = ChartProfile.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Other")
                .scope(ChartProfileScope.SESSION_MODE)
                .isDefault(true)
                .embedConfigJson(objectMapper.createObjectNode())
                .tjaPrefsJson(objectMapper.createObjectNode())
                .build();

        when(chartProfileRepository.findByIdAndUser_Id(targetId, user.getId())).thenReturn(Optional.of(target));
        when(chartProfileRepository.findByUser_IdAndScopeAndIsDefaultTrue(user.getId(), ChartProfileScope.SESSION_MODE))
                .thenReturn(List.of(otherDefault));

        var response = chartProfileService.setDefault(targetId);

        assertThat(response.isDefault()).isTrue();
        assertThat(target.isDefault()).isTrue();
        assertThat(otherDefault.isDefault()).isFalse();
        verify(chartProfileRepository).saveAll(argThat(items -> {
            List<ChartProfile> list = StreamSupport.stream(items.spliterator(), false).toList();
            return list.size() == 1 && list.get(0).getId().equals(otherDefault.getId());
        }));
    }

    @Test
    void deleteProfileRemovesOwnedProfile() {
        UUID profileId = UUID.randomUUID();
        ChartProfile profile = ChartProfile.builder()
                .id(profileId)
                .user(user)
                .name("Delete me")
                .scope(ChartProfileScope.SESSION_MODE)
                .isDefault(false)
                .embedConfigJson(objectMapper.createObjectNode())
                .tjaPrefsJson(objectMapper.createObjectNode())
                .build();
        when(chartProfileRepository.findByIdAndUser_Id(profileId, user.getId())).thenReturn(Optional.of(profile));

        chartProfileService.deleteProfile(profileId);

        verify(chartProfileRepository).delete(profile);
    }
}
