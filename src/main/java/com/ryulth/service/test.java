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
import java.util.concurrent.Future;

@Component
public class test implements EditorService {
    private static Logger logger = LoggerFactory.getLogger(SimpleEditorService.class);
    private final static int SNAPSHOT_CYCLE = 500;
    @Autowired
    DocsRepository docsRepository;
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    EditorAsyncService editorAsyncService;

    private final Map<Long, Docs> cacheDocs = new HashMap<>();
    private final Map<Long, ArrayDeque<PatchInfo>> cachePatches = new HashMap<>();
    private final Map<Long,Boolean> cacheIsUpdating = new HashMap<>();

    @Override
    public String editDocs(RequestDocsCommand requestDocsCommand,String remoteAddr) throws JsonProcessingException {
        Docs docs;
        ArrayDeque<PatchInfo> patchInfos;
        Boolean IsUpdating;
        Long docsId = requestDocsCommand.getDocsId();
        Long requestClientVersion = requestDocsCommand.getClientVersion();
        String patchText = requestDocsCommand.getPatchText();
        synchronized (cacheDocs) {
            docs = cacheDocs.get(docsId);
        }
        ArrayDeque<PatchInfo> tempPatchInfo;
        Long serverVersion;

        synchronized (cachePatches){
            patchInfos = cachePatches.get(docsId);
            tempPatchInfo = patchInfos.clone();
            serverVersion = tempPatchInfo.getLast().getPatchVersion();
            PatchInfo newPatchInfo = PatchInfo.builder()
                    .patchText(patchText)
                    .clientSessionId(requestDocsCommand.getSocketSessionId())
                    .remoteAddress(remoteAddr)
                    .patchVersion(serverVersion+1)
                    .build();
            cachePatches.get(docsId).add(newPatchInfo);
            tempPatchInfo.add(newPatchInfo);
            tempPatchInfo.poll();
        }
        if(tempPatchInfo.size()>SNAPSHOT_CYCLE && !cacheIsUpdating.get(docsId)){
            synchronized (cacheIsUpdating){
                cacheIsUpdating.replace(docsId,true);
            }
            Future<Boolean> future =editorAsyncService.updateDocsSnapshot(patchInfos, docs);
            while (true) {
                if (future.isDone()) {
                    synchronized (cacheIsUpdating) {
                        cacheIsUpdating.replace(docsId, false);
                    }
                    docsRepository.save(docs);
                    break;
                }
            }
        }
        //TODO 앞뒤변경
        if(serverVersion.equals(requestClientVersion)){
            tempPatchInfo.removeIf(p -> (p.getPatchVersion() <= requestClientVersion));
        }
        ResponseDocsCommand responseDocsCommand = ResponseDocsCommand.builder().docsId(docsId)
                .patchText(patchText)
                .patchInfos(tempPatchInfo)
                .socketSessionId(requestDocsCommand.getSocketSessionId())
                .serverVersion(serverVersion + 1).build();
        if (tempPatchInfo.size()>1) {
            responseDocsCommand.setSnapshotText(docs.getContent());
            responseDocsCommand.setSnapshotVersion(docs.getVersion());
            logger.info("버젼 충돌", requestClientVersion);
        }
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

    @Override
    public void patchesAll(Long docsId) {
        Docs docs;
        ArrayDeque<PatchInfo> patchInfos;
        synchronized (cacheDocs) {
            docs = cacheDocs.get(docsId);
        }
        synchronized (cachePatches) {
            patchInfos = cachePatches.get(docsId);
        }
        Future<Boolean> future =editorAsyncService.updateDocsSnapshot(patchInfos, docs);
        while (true) {
            if (future.isDone()) {
                docsRepository.save(docs);
                break;
            }
        }

    }

    private ArrayDeque<PatchInfo> getPatches(Docs finalDocs, Long docsId) {
        ArrayDeque<PatchInfo> patchInfo;
        synchronized (cachePatches) {
            patchInfo = cachePatches.get(docsId);
        }
        if (patchInfo == null) {
            patchInfo = new ArrayDeque<>();
            patchInfo.add(PatchInfo.builder().patchText("").patchVersion(finalDocs.getVersion()).remoteAddress("").build());
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
        synchronized (cacheIsUpdating){
            if(cacheIsUpdating.get(docsId)== null){
                cacheIsUpdating.put(docsId,false);
            }
        }
        return patchInfo;
    }

}
