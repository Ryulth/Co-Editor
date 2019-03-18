package com.ryulth.pojo.response;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;
import java.util.List;

public class VersionSerialize extends JsonSerializer<List<Content>> {
    public void serialize(List<Content> contents, JsonGenerator jgen, SerializerProvider provider) throws IOException, JsonProcessingException {
        jgen.writeStartObject();
        for(Content content : contents) {
            jgen.writeObjectField(String.valueOf(content.getVersion()), content);
        }
        jgen.writeEndObject();
    }
}
