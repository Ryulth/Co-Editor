package com.ryulth.pojo.request;

import lombok.Data;

@Data
public class RequestDocsCommand {
    public RequestDocsCommand(){
    }
    String socketSessionId;
    Long docsId;
    Long clientVersion;
    String patchText;
}
