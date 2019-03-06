package com.ryulth.service;

import com.ryulth.controller.DocsController;
import com.ryulth.pojo.request.Content;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.response.ResponseContent;
import com.ryulth.repository.DocsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.AsyncResult;
import org.springframework.stereotype.Component;

import java.util.concurrent.Future;

@Component
public class SimpleDocsService implements DocsService {
    private static Logger logger = LoggerFactory.getLogger(DocsController.class);

    @Autowired
    DocsRepository docsRepository;

    @Override
    @Async
    public Future<Boolean> updateDocs(Docs docs) {
        Docs tempDocs = docsRepository.findById(docs.getId()).orElse(null);
        if(tempDocs != null) {
            logger.info("save Start");
            tempDocs.setContent(docs.getContent());
            docsRepository.save(tempDocs);
            logger.info("save Success");
            return new AsyncResult<Boolean>(true);
        }
        return new AsyncResult<Boolean>(false);
    }

    @Override
    public ResponseContent transform(Content content, String sessionId) {




        return ResponseContent.builder().insertString(content.getInsertString())
                .insertPos(content.getInsertPos())
                .deleteLength(content.getDeleteLength())
                .deletePos(content.getDeletePos())
                .sessionId(sessionId).build();
    }
}
