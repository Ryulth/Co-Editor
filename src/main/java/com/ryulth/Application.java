package com.ryulth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@SpringBootApplication
@EnableAutoConfiguration
@EnableAsync
public class Application {
    public static void main(String args[]){
        SpringApplication.run(Application.class,args);
    }

    @Bean
    public TaskExecutor taskExecutor() {

        ThreadPoolTaskExecutor taskExecutor = new ThreadPoolTaskExecutor();
        taskExecutor.setCorePoolSize(10);
        taskExecutor.setQueueCapacity(50);
        taskExecutor.setMaxPoolSize(20);

        return taskExecutor;
    }

}
