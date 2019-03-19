package com.ryulth.pojo.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor(onConstructor = @__(@JsonIgnore)) // Lombok builder use this
public class ResponseDocsCommand {
    public ResponseDocsCommand(){
    }
    String socketSessionId;
    Long docsId;
    Long serverVersion;
    String patchText;
}
