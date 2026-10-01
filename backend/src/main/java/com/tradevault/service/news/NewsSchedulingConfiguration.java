package com.tradevault.service.news;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class NewsSchedulingConfiguration {
    @Bean(name="taskScheduler")
    ThreadPoolTaskScheduler applicationScheduler(@Value("${spring.task.scheduling.pool.size:1}") int size) {
        var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(Math.max(1,size));scheduler.setThreadNamePrefix("application-scheduling-");return scheduler;
    }
    @Bean(name="newsScheduler")
    ThreadPoolTaskScheduler newsScheduler() {
        // Bounded network work cannot delay existing notification and session jobs.
        var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("official-context-");return scheduler;
    }
}
