package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryulth.controller.DocsController;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.model.Delete;
import com.ryulth.pojo.model.Insert;
import com.ryulth.pojo.request.RequestCommand;
import com.ryulth.pojo.response.ResponseContent;
import com.ryulth.repository.DocsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.AsyncResult;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Future;

@Component
public class SimpleDocsService implements DocsService {
    private static Logger logger = LoggerFactory.getLogger(DocsController.class);
    private final Map<Long, Docs> cacheDocs = new HashMap<Long, Docs>();
    private static RequestCommand cacheRequestCommand;
    @Autowired
    ObjectMapper mapper;
    @Autowired
    DocsRepository docsRepository;

    @Override
    @Async
    public Future<Boolean> saveDocs(Docs docs) {
        Docs tempDocs = docsRepository.findById(docs.getId()).orElse(null);
        if (tempDocs != null) {
            logger.info("save Start");
            tempDocs.setContent(docs.getContent());
            docsRepository.save(tempDocs);
            logger.info("save Success");
            return new AsyncResult<Boolean>(true);
        }
        return new AsyncResult<Boolean>(false);
    }

    @Override
    public ResponseContent transform(RequestCommand requestCommand, String sessionId) {
        Insert insert = requestCommand.getCommands().getInsert();
        Delete delete = requestCommand.getCommands().getDelete();
        return ResponseContent.builder().insertLength(insert.getText().length())
                .insertPos(insert.getIndex())
                .deleteLength(delete.getSize())
                .deletePos(delete.getIndex())
                .sessionId(sessionId).build();
    }

    @Override
    public Docs getDocs(Long docsId) {
        Docs docs = docsRepository.findById(docsId).orElse(null);
        addCacheDocs(docsId, docs);
        return docs;
    }


    private void addCacheDocs(Long docsId, Docs docs) {
        if (cacheDocs.get(docsId) == null) {
            synchronized (cacheDocs) {
                cacheDocs.put(docsId, docs);
            }
        }
    }

    @Override
    public String putDocs(RequestCommand requestCommand) throws JsonProcessingException {
    /*
        logger.info("DocsId {} SessionId {} ", requestCommand.getDocsId(),requestCommand.getSessionId());
        if(Objects.isNull(cacheRequestCommand)){
            requestCommand.setCommands(ContentIndexer.calculateIndex(requestCommand.getCommands()));
        } else{
            requestCommand.setCommands(ContentIndexer.calculateIndex(cacheRequestCommand.getCommands(), requestCommand.getCommands()));
        }
        cacheRequestCommand = requestCommand;
    */

        Docs tempDocs =cacheDocs.get(requestCommand.getDocsId());

        Insert insert = requestCommand.getCommands().getInsert();
        Delete delete = requestCommand.getCommands().getDelete();
        //System.out.println(insert);
        StringBuffer stringBuffer = new StringBuffer();
        stringBuffer.append(tempDocs.getContent());
        stringBuffer.delete(delete.getIndex(),delete.getIndex()+delete.getSize());
        stringBuffer.insert(insert.getIndex(),insert.getText());
        tempDocs.setContent(stringBuffer.toString());
        //System.out.println(tempDocs);
        cacheDocs.replace(requestCommand.getDocsId(),tempDocs);

        ResponseContent responseContent = ResponseContent.builder().insertLength(insert.getText().length())
                .insertPos(insert.getIndex())
                .deleteLength(delete.getSize())
                .deletePos(delete.getIndex())
                .sessionId(requestCommand.getSessionId())
                .docs(tempDocs).build();
        return mapper.writeValueAsString(responseContent);
    }

}
