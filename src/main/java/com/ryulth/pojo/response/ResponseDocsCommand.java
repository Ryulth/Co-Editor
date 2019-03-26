package com.ryulth.pojo.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.ryulth.pojo.model.PatchInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.ArrayDeque;

@Data
@Builder
@AllArgsConstructor(onConstructor = @__(@JsonIgnore)) // Lombok builder use this
public class ResponseDocsCommand {
    public ResponseDocsCommand(){
    }
    String socketSessionId;
    Long docsId;
    Long serverVersion;
    Long snapshotVersion;
    String patchText;
    String snapshotText;
    ArrayDeque<PatchInfo> patchInfos;
    Long authorCaret;
}
