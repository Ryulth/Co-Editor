package com.ryulth.pojo.response;


import com.fasterxml.jackson.annotation.JsonIgnore;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.model.PatchInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor(onConstructor = @__(@JsonIgnore)) // Lombok builder use this
public class ResponseDocsInit {
    Docs docs;
    List<PatchInfo> patchInfos;
}
