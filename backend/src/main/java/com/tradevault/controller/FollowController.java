package com.tradevault.controller;

import com.tradevault.dto.follow.FollowRequest;
import com.tradevault.dto.follow.FollowResponse;
import com.tradevault.service.follow.FollowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/follows")
@RequiredArgsConstructor
public class FollowController {
    private final FollowService followService;

    @GetMapping
    public List<FollowResponse> list() {
        return followService.listCurrentUserFollows();
    }

    @PostMapping
    public ResponseEntity<FollowResponse> create(@Valid @RequestBody FollowRequest request) {
        return ResponseEntity.ok(followService.createCurrentUserFollow(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        followService.deleteCurrentUserFollow(id);
        return ResponseEntity.noContent().build();
    }
}
