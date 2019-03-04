package com.ryulth.pojo.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Builder
@Data
@AllArgsConstructor(onConstructor = @__(@JsonIgnore)) // Lombok builder use this
public class ResponseContent {

    public ResponseContent(){
    }

    private String sessionId;
    private String type;
    private String text;
    private int position;
}
