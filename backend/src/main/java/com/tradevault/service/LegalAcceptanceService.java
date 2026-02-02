package com.tradevault.service;

import com.tradevault.domain.entity.LegalAcceptance;
import com.tradevault.domain.entity.User;
import com.tradevault.domain.enums.LegalDocumentType;
import com.tradevault.repository.LegalAcceptanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class LegalAcceptanceService {
    private final LegalAcceptanceRepository legalAcceptanceRepository;

    public void record(User user,
                       LegalDocumentType docType,
                       String docVersion,
                       String ipAddress,
                       String userAgent,
                       String locale) {
        LegalAcceptance acceptance = LegalAcceptance.builder()
                .user(user)
                .docType(docType)
                .docVersion(docVersion)
                .acceptedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .locale(locale)
                .build();
        legalAcceptanceRepository.save(acceptance);
    }
}
