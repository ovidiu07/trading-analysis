package com.tradevault.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.maintenance")
public class MaintenanceProperties {
    private boolean databaseResetEnabled = false;
    private String databaseResetConfirmation = "RESET_TRADEJAUDIT_DATABASE_DATA";
    private boolean databaseResetAllowedInProduction = false;
}
