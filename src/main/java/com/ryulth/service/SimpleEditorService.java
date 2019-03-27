package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.model.PatchInfo;
import com.ryulth.pojo.request.RequestDocsCommand;
import com.ryulth.pojo.response.ResponseDocsCommand;
import com.ryulth.pojo.response.ResponseDocsInit;
import com.ryulth.repository.DocsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

@Component
public class SimpleEditorService implements EditorService {
    private static Logger logger = LoggerFactory.getLogger(SimpleEditorService.class);
    @Autowired
    DocsRepository docsRepository;
    @Autowired
    ObjectMapper objectMapper;
    @Autowired(required = false)
    diff_match_patch dmp;

    private final Map<Long, Docs> cacheDocs = new HashMap<>();
    private final Map<Long, ArrayDeque<PatchInfo>> cachePatches = new HashMap<>();

    @Override
    public String editDocs(RequestDocsCommand requestDocsCommand) throws JsonProcessingException {
        Docs docs;
        Long docsId = requestDocsCommand.getDocsId();
        Long requestClientVersion = requestDocsCommand.getClientVersion();
        String patchText = requestDocsCommand.getPatchText();
        int startIdx = requestDocsCommand.getStartIdx();
        int endIdx = requestDocsCommand.getEndIdx();
        synchronized (cacheDocs) {
            docs = cacheDocs.get(docsId);
        }
        ArrayDeque<PatchInfo> tempPatchInfo;
        Long serverVersion;

        synchronized (cachePatches){
            tempPatchInfo = cachePatches.get(docsId).clone();
            serverVersion = tempPatchInfo.getLast().getPatchVersion();
            PatchInfo newPatchInfo = PatchInfo.builder()
                    .patchText(patchText)
                    .clientSessionId(requestDocsCommand.getSocketSessionId())
                    .patchVersion(serverVersion+1)
                    .startIdx(startIdx)
                    .endIdx(endIdx).build();
            cachePatches.get(docsId).add(newPatchInfo);
            tempPatchInfo.add(newPatchInfo);
            tempPatchInfo.poll();
        }
        if(requestClientVersion.equals(serverVersion)){
            tempPatchInfo.removeIf(p -> (p.getPatchVersion() <= requestClientVersion));
        }
        ResponseDocsCommand responseDocsCommand = ResponseDocsCommand.builder().docsId(docsId)
                .patchText(patchText)
                .patchInfos(tempPatchInfo)
                .socketSessionId(requestDocsCommand.getSocketSessionId())
                .snapshotText(docs.getContent())
                .snapshotVersion(docs.getVersion())
                .serverVersion(serverVersion + 1).build();
        if (requestClientVersion < serverVersion) {
            logger.info("버젼 충돌", requestClientVersion);
        }
        //Thread.sleep(1000);
        return objectMapper.writeValueAsString(responseDocsCommand);
    }

    @Override
    public String getDocsOne(Long docsId) throws JsonProcessingException {
        ResponseDocsInit responseDocsInit;
        Docs docs;
        synchronized (cacheDocs) {
            docs = cacheDocs.get(docsId);
        }
        if (docs == null) {
            //TODO 나중에 null 처리
            docs = docsRepository.findById(docsId).orElse(null);
            synchronized (cacheDocs) {
                cacheDocs.put(docsId, docs);
            }
        }
        ArrayDeque<PatchInfo> patchInfoList = getPatches(docs, docsId);
        responseDocsInit = ResponseDocsInit.builder().docs(docs).patchInfos(patchInfoList).build();
        return objectMapper.writeValueAsString(responseDocsInit);
    }

    private ArrayDeque<PatchInfo> getPatches(Docs finalDocs, Long docsId) {
        ArrayDeque<PatchInfo> patchInfo;
        synchronized (cachePatches) {
            patchInfo = cachePatches.get(docsId);
        }
        if (patchInfo == null) {
            patchInfo = new ArrayDeque<>();
            patchInfo.add(PatchInfo.builder().patchText("").patchVersion(finalDocs.getVersion()).build());
            synchronized (cachePatches) {
                cachePatches.put(docsId, patchInfo);
            }
        } else {
            patchInfo = patchInfo.clone();
        }
        if (patchInfo.size() == 0) {
            System.out.println("sadasdas");
            return null;
        }
        if (finalDocs.getVersion() < patchInfo.getLast().getPatchVersion()) {
            patchInfo.removeIf(p -> (p.getPatchVersion() < finalDocs.getVersion()));
        }
        return patchInfo;
    }
}
