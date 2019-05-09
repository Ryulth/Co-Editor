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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.stereotype.Component;

import javax.print.Doc;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@Component
public class SimpleEditorService implements EditorService {
    private static Logger logger = LoggerFactory.getLogger(SimpleEditorService.class);
    private final static int SNAPSHOT_CYCLE = 10000;
    @Autowired
    DocsRepository docsRepository;
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    EditorAsyncService editorAsyncService;
    @Autowired
    RedisTemplate redisTemplate;
    private final static String DOCS_MAP = "editor:docs:";
    private final static String PATCHES_MAP = "editor:patches:";
    private final static String IS_UPDATING = "editor:isUpdating:";
    private final Map<Long, Boolean> syncDocs = new ConcurrentHashMap<>();
    private final Map<Long, ArrayDeque<PatchInfo>> cachePatches = new ConcurrentHashMap<>();
    @Override
    public String editDocs(RequestDocsCommand requestDocsCommand, String remoteAddr) throws JsonProcessingException {
        ValueOperations vop = redisTemplate.opsForValue();
        ListOperations lop = redisTemplate.opsForList();
        Long docsId = requestDocsCommand.getDocsId();
        Long requestClientVersion = requestDocsCommand.getClientVersion();
        String patchText = requestDocsCommand.getPatchText();
        List<PatchInfo> patchInfoList;
        Long serverVersion;
        synchronized (cachePatches.get(docsId)) {
            patchInfoList = lop.range(PATCHES_MAP + docsId, 0, -1);
            serverVersion = ((PatchInfo) lop.index(PATCHES_MAP + docsId, -1)).getPatchVersion();
            PatchInfo newPatchInfo2 = PatchInfo.builder()
                    .patchText(patchText).clientSessionId(requestDocsCommand.getSocketSessionId())
                    .remoteAddress(remoteAddr)
                    .patchVersion(serverVersion + 1)
                    .build();
            lop.rightPush(PATCHES_MAP + docsId, newPatchInfo2);
            patchInfoList.add(newPatchInfo2);
            patchInfoList.remove(0);
        }

            boolean isUpdating = (boolean) vop.get(IS_UPDATING + docsId);
            if (patchInfoList.size() > SNAPSHOT_CYCLE && !isUpdating) {
                vop.set(IS_UPDATING + docsId, true);
                Docs docs = (Docs) vop.get(DOCS_MAP + docsId);
                Future<Boolean> future = editorAsyncService.updateDocsSnapshot(patchInfoList, docs);
                while (true) {
                    if (future.isDone()) {
                        vop.set(IS_UPDATING + docsId, false);
                        docsRepository.save(docs);
                        break;
                    }
                }
            }
            //TODO 앞뒤변경
            if (serverVersion.equals(requestClientVersion)) {
                patchInfoList.removeIf(p -> (p.getPatchVersion() <= requestClientVersion));
            }
            ResponseDocsCommand responseDocsCommand = ResponseDocsCommand.builder().docsId(docsId)
                    .patchText(patchText)
                    .patchInfos(patchInfoList)
                    .socketSessionId(requestDocsCommand.getSocketSessionId())
                    .serverVersion(serverVersion + 1).build();
            if (patchInfoList.size() > 1) {
                Docs docs = (Docs) vop.get(DOCS_MAP + docsId);
                responseDocsCommand.setSnapshotText(docs.getContent());
                responseDocsCommand.setSnapshotVersion(docs.getVersion());
                logger.info("버젼 충돌", requestClientVersion);
            }
            return objectMapper.writeValueAsString(responseDocsCommand);

    }

    @Override
    public String getDocsOne(Long docsId) throws JsonProcessingException {
        ValueOperations vop = redisTemplate.opsForValue();
        ResponseDocsInit responseDocsInit;
        Docs docs = (Docs) vop.get(DOCS_MAP + docsId);
        if (docs == null) {
            docs = docsRepository.findById(docsId).orElse(null);
            vop.set(DOCS_MAP + docsId, docs);
        }
        responseDocsInit = ResponseDocsInit.builder()
                .docs(docs)
                .patchInfos(getPatches(docs, docsId)).build();
        return objectMapper.writeValueAsString(responseDocsInit);
    }

    @Override
    public void patchesAll(Long docsId) {
        ValueOperations vop = redisTemplate.opsForValue();
        ListOperations lop = redisTemplate.opsForList();
        checkSyncMap(docsId);
        synchronized (syncDocs.get(docsId)) {
//            Docs docs = (Docs) vop.get(DOCS_MAP + docsId);
//            List<PatchInfo> patchInfoList = lop.range(PATCHES_MAP + docsId, 0, -1);
//            Future<Boolean> future = editorAsyncService.updateDocsSnapshot(patchInfoList, docs);
//            while (true) {
//                if (future.isDone()) {
//                    docsRepository.save(docs);
//                    break;
//                }
//            }
        }
    }

    private ArrayDeque<PatchInfo> getPatches(Docs finalDocs, Long docsId) {
        ValueOperations vop = redisTemplate.opsForValue();
        long startNanos = System.nanoTime();
        ArrayDeque<PatchInfo> patchInfoList = getPatchesList(finalDocs, docsId);

        if (finalDocs.getVersion() < patchInfoList.getLast().getPatchVersion()) {
            patchInfoList.removeIf(p -> (p.getPatchVersion() < finalDocs.getVersion()));
        }
        if (vop.get(IS_UPDATING + docsId) == null) {
            vop.set(IS_UPDATING + docsId, false);
        }

        System.out.println(docsId + "TIME     " + TimeUnit.MILLISECONDS.convert(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS));
        return patchInfoList;
    }

    private ArrayDeque<PatchInfo> getPatchesList(Docs finalDocs, Long docsId) {
        checkSyncMap(docsId);
        checkCachePatched(finalDocs,docsId);
        synchronized (cachePatches.get(docsId)) {
            ArrayDeque<PatchInfo> patchInfos =cachePatches.get(docsId).clone();
            if (finalDocs.getVersion() < patchInfos.getLast().getPatchVersion()) {
                patchInfos.removeIf(p -> (p.getPatchVersion() < finalDocs.getVersion()));
            }
            return patchInfos;
        }
    }
    private void checkCachePatched(Docs finalDocs,Long docsId) {
        if (cachePatches.get(docsId) == null) {
            PatchInfo initPatchInfo = PatchInfo.builder().patchText("").patchVersion(finalDocs.getVersion()).remoteAddress("").build();
            ArrayDeque<PatchInfo> patchInfos = new ArrayDeque<>();
            patchInfos.add(initPatchInfo);
            cachePatches.putIfAbsent(docsId,patchInfos);
        }
    }
    private void checkSyncMap(Long docsId) {
        if (syncDocs.get(docsId) == null) {
            syncDocs.putIfAbsent(docsId, true);
        }
    }
}
