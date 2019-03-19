package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryulth.dto.Docs;
import com.ryulth.pojo.model.PatchInfo;
import com.ryulth.pojo.request.RequestDocsCommand;
import com.ryulth.pojo.response.ResponseDocsCommand;
import com.ryulth.pojo.response.ResponseDocsInit;
import com.ryulth.repository.DocsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class SimpleEditorService implements EditorService {
    @Autowired
    DocsRepository docsRepository;
    @Autowired
    ObjectMapper objectMapper;
    @Autowired(required = false)
    diff_match_patch dmp;

    private final Map<Long, Docs> cacheDocs = new HashMap<>();
    private final Map<Long, ArrayDeque<PatchInfo>> cachePatches = new HashMap<>();

    @Override
    public String editDocs(RequestDocsCommand requestDocsCommand) throws JsonProcessingException, InterruptedException {

        Docs docs;
        Long docsId = requestDocsCommand.getDocsId();
        Long requestClientVersion = requestDocsCommand.getClientVersion();
        String patchText = requestDocsCommand.getPatchText();
        synchronized (cacheDocs) {
            docs = cacheDocs.get(docsId);
        }
        ArrayDeque<PatchInfo> patchInfo;
        Long serverVersion;

        synchronized (cachePatches){
            patchInfo = cachePatches.get(docsId).clone();
            serverVersion = patchInfo.getLast().getPatchVersion();
            PatchInfo newPatchInfo = PatchInfo.builder()
                    .patchText(patchText)
                    .clientSessionId(requestDocsCommand.getSocketSessionId())
                    .patchVersion(serverVersion+1).build();
            cachePatches.get(docsId).add(newPatchInfo);
            patchInfo.add(newPatchInfo);
        }
        //TODO 알고리즘 최적화
        if (requestClientVersion <= serverVersion) {
            //patchInfo = patchInfo.stream().filter(p -> p.getPatchVersion() > requestClientVersion).collect(Collectors.toCollection(ArrayDeque::new));
            System.out.println(patchInfo);
            System.out.println(requestClientVersion);
            patchInfo.removeIf(p -> (p.getPatchVersion() <= requestClientVersion));
            System.out.println("버젼 충돌 날때@@@@@@@@@@@@@@@@");
            System.out.println(patchInfo);
            System.out.println(requestDocsCommand);
        }
         //= docs.getVersion();
        //if(serverVersion == requestDocsCommand.getClientVersion()){
        //List<diff_match_patch.Patch> patches = dmp.patch_fromText(patchText);
        //System.out.println(dmp.patch_apply((LinkedList<diff_match_patch.Patch>) patches,docs.getContent()));
        ResponseDocsCommand responseDocsCommand = ResponseDocsCommand.builder().docsId(docsId)
                .patchText(patchText)
                .patchInfos(patchInfo)
                .socketSessionId(requestDocsCommand.getSocketSessionId())
                .serverVersion(serverVersion + 1).build();

        //docs.setVersion(serverVersion + 1);
        //synchronized (cacheDocs) {
        //    docs = cacheDocs.replace(docsId, docs);
        //}
        Thread.sleep(1000);
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
        if (patchInfo == null){
            patchInfo = new ArrayDeque<>();
            patchInfo.add(PatchInfo.builder().patchText("").patchVersion(Long.valueOf(0)).build());
            synchronized (cachePatches) {
                cachePatches.put(docsId,patchInfo);
            }
        }
        else {
            patchInfo = patchInfo.clone();
        }
        if(patchInfo.size() == 0){
            System.out.println("sadasdas");
            return null;
        }
        if (finalDocs.getVersion() < patchInfo.getLast().getPatchVersion()) {
            patchInfo.removeIf(p -> (p.getPatchVersion() < finalDocs.getVersion()));
        }
        return patchInfo;
    }
}
