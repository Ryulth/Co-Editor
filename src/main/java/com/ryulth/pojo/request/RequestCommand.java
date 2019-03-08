package com.ryulth.pojo.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ryulth.pojo.model.Commands;
import lombok.Data;

@Data
public class RequestCommand {
    public RequestCommand(){
    }
    @JsonProperty("commands")
    Commands commands;
    String sessionId;
    Long docsId;
}
