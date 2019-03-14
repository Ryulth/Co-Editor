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
    private static RequestCommand cacheRequestCommands[] = new RequestCommand[1000];
    int version = 0;

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
        addCacheDocs(docsId);
        synchronized (cacheDocs) {
            return cacheDocs.get(docsId);
        }
    }


    private void addCacheDocs(Long docsId) {
        if (cacheDocs.get(docsId) == null) {
            Docs docs = docsRepository.findById(docsId).orElse(null);
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
        Long requestVersion = requestCommand.getCommands().getVersion();
        while(requestVersion < version){
            positionIndexing(requestCommand);
            requestVersion = requestCommand.getCommands().getVersion();
        }
        cacheRequestCommands[version] = requestCommand;
        version++;
        requestCommand.getCommands().setVersion(Long.valueOf(version));
//    --------------------------------------------------------------------------------------------
        Docs tempDocs;
        synchronized (cacheDocs) {
            tempDocs = cacheDocs.get(requestCommand.getDocsId());
        }


        Insert insert = requestCommand.getCommands().getInsert();
        Delete delete = requestCommand.getCommands().getDelete();
        Long clientVersion = requestCommand.getCommands().getVersion();
        if (clientVersion.equals(tempDocs.getVersion())) {
            System.out.println("같다네!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@!@");

        } else {
            System.out.println("틀림ㄲ########################################################");
        }

        System.out.println(tempDocs);
        StringBuffer stringBuffer = new StringBuffer();
        stringBuffer.append(tempDocs.getContent());

        stringBuffer.delete(delete.getIndex(), delete.getIndex() + delete.getSize());
        stringBuffer.insert(insert.getIndex(), insert.getText());
        tempDocs.setContent(stringBuffer.toString());
        tempDocs.setVersion(clientVersion + 1);

        synchronized (cacheDocs) {
            cacheDocs.replace(requestCommand.getDocsId(), tempDocs);
        }

        ResponseContent responseContent = ResponseContent.builder().insertLength(insert.getText().length())
                .insertPos(insert.getIndex())
                .deleteLength(delete.getSize())
                .deletePos(delete.getIndex())
                .sessionId(requestCommand.getSessionId())
                .docs(tempDocs).build();
        return mapper.writeValueAsString(responseContent);
    }

    private void positionIndexing(RequestCommand requestCommand){
        Long requestVersion = requestCommand.getCommands().getVersion();
        RequestCommand cacheRequestCommand = cacheRequestCommands[Math.toIntExact(requestVersion)];
        int cacheInsertIndex = cacheRequestCommand.getCommands().getInsert().getIndex();
        int cacheDeleteIndex = cacheRequestCommand.getCommands().getDelete().getIndex();
        int requestInsertIndex = requestCommand.getCommands().getInsert().getIndex();
        int requestDeleteIndex = requestCommand.getCommands().getInsert().getIndex();

        if(cacheInsertIndex < requestInsertIndex){
            requestCommand.getCommands().getInsert().setIndex(cacheRequestCommand.getCommands().getInsert().getText().length() + requestInsertIndex);
        }
        if(cacheDeleteIndex < requestInsertIndex){
            requestCommand.getCommands().getInsert().setIndex(cacheRequestCommand.getCommands().getInsert().getText().length() - cacheRequestCommand.getCommands().getDelete().getSize());
        }
        if(cacheDeleteIndex < requestDeleteIndex){
            requestCommand.getCommands().getDelete().setIndex(requestDeleteIndex - cacheRequestCommand.getCommands().getDelete().getSize());
        }
        if(cacheInsertIndex < requestDeleteIndex){
            requestCommand.getCommands().getInsert().setIndex(cacheRequestCommand.getCommands().getInsert().getText().length() + requestDeleteIndex);
        }

        requestCommand.getCommands().setVersion(requestVersion+1);
    }
}
