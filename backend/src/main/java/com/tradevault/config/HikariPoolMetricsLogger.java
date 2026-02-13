package com.tradevault.config;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
@Slf4j
public class HikariPoolMetricsLogger {
    private final HikariDataSource hikariDataSource;

    public HikariPoolMetricsLogger(DataSource dataSource) {
        this.hikariDataSource = dataSource instanceof HikariDataSource hikari ? hikari : null;
        if (this.hikariDataSource == null) {
            log.debug("HikariPoolMetricsLogger disabled because datasource is not Hikari ({})", dataSource.getClass().getName());
        }
    }

    @Scheduled(fixedDelayString = "${metrics.hikari.log-interval-ms:30000}")
    public void logPoolStats() {
        if (hikariDataSource == null) {
            return;
        }

        HikariPoolMXBean poolMXBean = hikariDataSource.getHikariPoolMXBean();
        if (poolMXBean == null) {
            return;
        }

        int active = poolMXBean.getActiveConnections();
        int idle = poolMXBean.getIdleConnections();
        int total = poolMXBean.getTotalConnections();
        int pending = poolMXBean.getThreadsAwaitingConnection();
        int maxPoolSize = hikariDataSource.getMaximumPoolSize();
        String poolName = hikariDataSource.getPoolName();
        String threadName = Thread.currentThread().getName();

        log.info(
                "Hikari pool={} active={} idle={} total={} pending={} maxPoolSize={} thread={}",
                poolName,
                active,
                idle,
                total,
                pending,
                maxPoolSize,
                threadName
        );

        if (active >= Math.max(0, maxPoolSize - 1) || pending > 0) {
            log.warn(
                    "Hikari pressure detected pool={} active={} idle={} total={} pending={} maxPoolSize={} thread={}",
                    poolName,
                    active,
                    idle,
                    total,
                    pending,
                    maxPoolSize,
                    threadName
            );
        }
    }
}
