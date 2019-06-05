package com.ryulth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.RequestMethod;
import springfox.documentation.builders.ApiInfoBuilder;
import springfox.documentation.builders.PathSelectors;
import springfox.documentation.builders.RequestHandlerSelectors;
import springfox.documentation.builders.ResponseMessageBuilder;
import springfox.documentation.schema.ModelRef;
import springfox.documentation.service.ApiInfo;
import springfox.documentation.service.ResponseMessage;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spring.web.plugins.Docket;
import springfox.documentation.swagger2.annotations.EnableSwagger2;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableSwagger2
public class SwaggerConfig {

    @Bean
    public Docket api() {
        return new Docket(DocumentationType.SWAGGER_2)
                .apiInfo(apiInfo())
                .select()
                .apis(RequestHandlerSelectors.basePackage("com.ryulth.controller"))
                .paths(PathSelectors.any())
                .build()
                .useDefaultResponseMessages(false)
                .globalResponseMessage(RequestMethod.GET,getArrayList());
    }
    private List<ResponseMessage> getArrayList() {
        List<ResponseMessage> responseMessages = new ArrayList<>();
        responseMessages.add(new ResponseMessageBuilder()
                .code(500)
                .message("Internal Server Error")
                .responseModel(new ModelRef("Error"))
                .build());
        responseMessages.add( new ResponseMessageBuilder()
                .code(400)
                .message("Bad Request")
                .build());
        responseMessages.add(new ResponseMessageBuilder()
                .code(404)
                .message("Not Found")
                .build());
        return responseMessages;
    }

    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
                .title("test swagger2")
                .description("swagger2 사용해 봅시다.")
                .build();

    }
}
