package com.ryulth.pojo.response;

import lombok.Data;

@Data
public class ResponseContent {
    public ResponseContent(String text, String sessionId) {
        this.text = text;
        this.sessionId = sessionId;
    }

    private String sessionId;
    private String text;
}
