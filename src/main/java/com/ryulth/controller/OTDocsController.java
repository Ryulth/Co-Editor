//package com.ryulth.controller;
//
//import com.ryulth.dto.Docs;
//import com.ryulth.pojo.request.RequestCommand;
//import com.ryulth.repository.DocsRepository;
//import com.ryulth.service.OTDocsService;
//import org.slf4j.Logger;
//import org.slf4j.LoggerFactory;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.messaging.simp.SimpMessagingTemplate;
//import org.springframework.web.bind.annotation.*;
//
//@RestController
//public class OTDocsController {
//    private static Logger logger = LoggerFactory.getLogger(DocsController.class);
//    @Autowired
//    SimpMessagingTemplate simpMessagingTemplate;
//    @Autowired
//    DocsRepository docsRepository;
//    @Autowired
//    OTDocsService otDocsService;
//
//    @GetMapping("/docs/{docsId}")
//    public Docs getDocsDetail(@PathVariable("docsId") Long docsId){
//        System.out.println("aaaaaaaaaaaaaaaa");
//        return otDocsService.getDocs(docsId);
//    }
//
//    @PostMapping("/docs/{docsId}") // 받아오는 곳
//    public void putDocs(@PathVariable Long docsId, @RequestBody RequestCommand requestCommand) throws Exception {
//        this.simpMessagingTemplate.convertAndSend("/topic/docs/"+docsId,
//                otDocsService.putDocs(requestCommand));
//    }
//}
