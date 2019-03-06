package com.ryulth.service;

import com.ryulth.pojo.request.Content;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.response.ResponseContent;
import org.springframework.stereotype.Service;

import java.util.concurrent.Future;

@Service
public interface DocsService {
    Future<Boolean> updateDocs(Docs docs);
    ResponseContent transform(Content content,String sessionId);
}
