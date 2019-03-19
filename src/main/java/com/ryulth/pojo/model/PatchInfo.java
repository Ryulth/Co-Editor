package com.ryulth.pojo.model;


import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor(onConstructor = @__(@JsonIgnore)) // Lombok builder use this
public class PatchInfo {
    public PatchInfo(){

    }
    Long patchVersion;
    String patchText;
}
