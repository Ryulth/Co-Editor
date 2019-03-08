package com.ryulth.pojo.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class Commands {
    public Commands(){

    }
    @JsonProperty("delete")
    Delete delete;
    @JsonProperty("insert")
    Insert insert;
    String originalLength;
}
