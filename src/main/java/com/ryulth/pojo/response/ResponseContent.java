package com.ryulth.pojo.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.ryulth.dto.Docs;
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
    private String insertString;
    private int insertPos;
    private int deleteLength;
    private int deletePos;
    private Long version;
}
