package com.ryulth.pojo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@Builder
@AllArgsConstructor(onConstructor = @__(@JsonIgnore)) // Lombok builder use this
@EqualsAndHashCode(callSuper = false)
public class Account {
    public Account(){
    }
    String clientSessionId;
    String remoteAddress;
}

