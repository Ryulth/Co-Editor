package com.ryulth.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ryulth.pojo.request.RequestDocsCommand;
import com.ryulth.service.EditorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;


@RestController
public class EditorController {
    private static Logger logger = LoggerFactory.getLogger(EditorController.class);
    @Autowired
    SimpMessagingTemplate simpMessagingTemplate;
    @Autowired
    EditorService editorService;

    @CrossOrigin("*")
    @GetMapping("/docs/{docsId}")
    public String getDocsOne(@PathVariable("docsId") Long docsId) throws JsonProcessingException {
        return editorService.getDocsOne(docsId);
    }


    @CrossOrigin("*")
    @PostMapping("/docs/{docsId}")
    public void editDocs(@PathVariable Long docsId, @RequestBody RequestDocsCommand requestDocsCommnad) throws JsonProcessingException {
        this.simpMessagingTemplate.convertAndSend("/topic/docs/" + docsId,
                editorService.editDocs(requestDocsCommnad));
    }
}
