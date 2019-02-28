package com.ryulth.service;

import com.ryulth.controller.DocsController;
import com.ryulth.dto.Docs;
import com.ryulth.repository.DocsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class SimpleDocsService implements DocsService {
    private static Logger logger = LoggerFactory.getLogger(DocsController.class);

    @Autowired
    DocsRepository docsRepository;

    @Override
    public Boolean saveDocs(Docs docs) {
        Docs tempDocs = docsRepository.findById(docs.getId()).orElse(null);
        if(tempDocs != null) {
            tempDocs.setContent(docs.getContent());
            docsRepository.save(tempDocs);
            logger.info("save Success");
            return true;
        }
        return false;
    }
}
