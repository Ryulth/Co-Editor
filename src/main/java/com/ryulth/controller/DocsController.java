package com.ryulth.controller;


import com.ryulth.dto.Docs;
import com.ryulth.pojo.request.RequestCommand;
import com.ryulth.pojo.response.ResponseContent;
import com.ryulth.pojo.response.ResponseDocs;
import com.ryulth.pojo.response.ResponseStatus;
import com.ryulth.repository.DocsRepository;
import com.ryulth.service.DocsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpSession;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@RestController
public class DocsController{
    private static Logger logger = LoggerFactory.getLogger(DocsController.class);
    @Autowired
    SimpMessagingTemplate template;
    @Autowired
    DocsRepository docsRepository;
    @Autowired
    DocsService docsService;

    @MessageMapping("/docs/{docsId}") // 받아오는 곳
    @SendTo("/topic/docs/{docsId}") // 이 주제에 전송 이주제를 구독하고 있는 사용자는 바로 받아볼 수 있음
    public ResponseContent getContent (@DestinationVariable String docsId, RequestCommand requestCommand, SimpMessageHeaderAccessor headerAccessor) throws Exception{
        String sessionId = headerAccessor.getSessionId();
        logger.info("SessionId {}",sessionId);
        return docsService.transform(requestCommand,sessionId);
    }
    // 메인 페이지 리스트
    @GetMapping("/docs")
    public ResponseDocs getDocs(){
        return new ResponseDocs(StreamSupport.stream(docsRepository.findAll().spliterator(),false).
                collect(Collectors.toList()));
    }
    // 창을 오픈할때
    @GetMapping("/docs/{docsId}")
    public Docs getDocsDetail(@PathVariable("docsId") Long docsId){
        return docsService.getDocs(docsId);
    }
    // 글자 입력시 변경점 저장
    @PutMapping("/docs")
    public ResponseStatus updateDocs(@RequestBody Docs docs, HttpSession session) throws Exception{
        String sessionId = session.getId();
        logger.info("SessionId {}",sessionId);
        Future<Boolean> executor = docsService.saveDocs(docs);
        while (!executor.isDone()) {
        }
        return new ResponseStatus(executor.get().toString());
    }

    @PostMapping("/docs/{docsId}") // 받아오는 곳
    public void putDocs(@PathVariable Long docsId, @RequestBody RequestCommand requestCommand) throws Exception {
        this.template.convertAndSend("/topic/docs/"+docsId,
                docsService.putDocs(requestCommand));
    }

}
