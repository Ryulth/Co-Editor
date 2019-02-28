package com.ryulth.controller;


import com.ryulth.dto.Content;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.response.ResponseContent;
import com.ryulth.pojo.response.ResponseDocs;
import com.ryulth.pojo.response.ResponseStatus;
import com.ryulth.repository.DocsRepository;
import com.ryulth.service.DocsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.HtmlUtils;

import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@RestController
public class DocsController{
    private static Logger logger = LoggerFactory.getLogger(DocsController.class);

    @Autowired
    DocsRepository docsRepository;
    @Autowired
    DocsService docsService;

    @MessageMapping("/docs") // 받아오는 곳
    @SendTo("/topic/docs") // 이 주제에 전송 이주제를 구독하고 있는 사용자는 바로 받아볼 수 있음
    public ResponseContent getContent (Content content, SimpMessageHeaderAccessor headerAccessor) throws Exception{
        String sessionId = headerAccessor.getSessionId();
        //Thread.sleep(500);
        logger.info("SessionId {}",sessionId);
        return new ResponseContent(HtmlUtils.htmlEscape(content.getText()),sessionId);
    }
    @GetMapping("/docs")
    public ResponseDocs getDocs(){
        return new ResponseDocs(StreamSupport.stream(docsRepository.findAll().spliterator(),false).
                collect(Collectors.toList()));
    }
    @GetMapping("/docs/{id}")
    public Docs getDocsDetail(@PathVariable("id") Long id){

        return docsRepository.findById(id).orElse(null);
    }
    @Async
    @PostMapping("/docs")
    public ResponseStatus saveDocs(@RequestBody Docs docs){
        if(docsService.saveDocs(docs))
            return new ResponseStatus("success");
        return new ResponseStatus("fail");
    }

}
