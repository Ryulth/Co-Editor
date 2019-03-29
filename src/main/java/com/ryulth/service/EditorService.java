package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ryulth.pojo.request.RequestDocsCommand;
import org.springframework.stereotype.Service;

@Service
public interface EditorService {
    String editDocs(RequestDocsCommand requestDocsCommand,String remoteAddr) throws JsonProcessingException, InterruptedException;
    String getDocsOne(Long docsId) throws JsonProcessingException;
}
