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
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.connection.stream.ObjectRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class SimpleEditorService implements EditorService {
    private static Logger logger = LoggerFactory.getLogger(SimpleEditorService.class);
    private final static int SNAPSHOT_CYCLE = 500;
    @Autowired
    DocsRepository docsRepository;
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    EditorAsyncService editorAsyncService;
    @Autowired
    RedisTemplate redisTemplate;
    private final static String DOCS_MAP = "editor:docs:";
    private final static String PATCHES_REDIS = "editor:patches:";
    private final static String IS_UPDATING = "editor:isUpdating:";

    @Override
    public String editDocs(RequestDocsCommand requestDocsCommand, String remoteAddr) throws JsonProcessingException {
        ValueOperations vop = redisTemplate.opsForValue();
        StreamOperations sop = redisTemplate.opsForStream();

        Long docsId = requestDocsCommand.getDocsId();
        Long requestClientVersion = requestDocsCommand.getClientVersion();
        String patchText = requestDocsCommand.getPatchText();

        PatchInfo newPatchInfo = PatchInfo.builder()
                .patchText(patchText)
                .clientSessionId(requestDocsCommand.getSocketSessionId())
                .remoteAddress(remoteAddr)
                .patchVersion(requestClientVersion + 1)
                .build();
        while (true) {
            try {
                xAdd(PATCHES_REDIS + docsId,
                        docsId + "-" + newPatchInfo.getPatchVersion().toString(), newPatchInfo);
                break;
            } catch (RedisSystemException ignore) {
                newPatchInfo.setPatchVersion(newPatchInfo.getPatchVersion() + 1);
            }
        }
        Docs docs = (Docs) vop.get(DOCS_MAP + docsId);
        List<PatchInfo> patchInfoList = readPatchList(docsId, docs.getVersion());
        Long serverVersion = patchInfoList.get(patchInfoList.size() - 1).getPatchVersion();
        if (serverVersion.equals(requestClientVersion)) {
            patchInfoList.removeIf(p -> (p.getPatchVersion() <= requestClientVersion));
        }
        ResponseDocsCommand responseDocsCommand = ResponseDocsCommand.builder().docsId(docsId)
                .patchText(patchText)
                .patchInfos(patchInfoList)
                .socketSessionId(requestDocsCommand.getSocketSessionId())
                .serverVersion(serverVersion + 1).build();
        if (patchInfoList.size() > 1) {
            responseDocsCommand.setSnapshotText(docs.getContent());
            responseDocsCommand.setSnapshotVersion(docs.getVersion());
        }
        if (patchInfoList.size() > SNAPSHOT_CYCLE) {
            Future<Boolean> future = editorAsyncService.updateDocsSnapshot(patchInfoList, docs);
            while (true) {
                if (future.isDone()) {
                    vop.set(DOCS_MAP + docsId, docs);
                    docsRepository.save(docs);
                    System.out.println("업데이트완료");
                    break;
                }
            }
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
        System.out.println(docs);
        responseDocsInit = ResponseDocsInit.builder()
                .docs(docs)
                .patchInfos(getPatches(docs, docsId)).build();
        return objectMapper.writeValueAsString(responseDocsInit);
    }


    @Override
    public void patchesAll(Long docsId) {
        ValueOperations vop = redisTemplate.opsForValue();
        Docs docs = (Docs) vop.get(DOCS_MAP + docsId);
        List<PatchInfo> patchInfoList = readPatchList(docsId, docs.getVersion());
        Future<Boolean> future = editorAsyncService.updateDocsSnapshot(patchInfoList, docs);
        while (true) {
            if (future.isDone()) {
                docsRepository.save(docs);
                vop.set(DOCS_MAP + docsId, docs);
                break;
            }
        }

    }

    private List<PatchInfo> getPatches(Docs finalDocs, Long docsId) {
        ValueOperations vop = redisTemplate.opsForValue();
        long startNanos = System.nanoTime();
        List<PatchInfo> patchInfoList = readPatchList(docsId, finalDocs.getVersion());

        if (patchInfoList.size() != 0 && finalDocs.getVersion() < patchInfoList.get(patchInfoList.size() - 1).getPatchVersion()) {
            patchInfoList.removeIf(p -> (p.getPatchVersion() < finalDocs.getVersion()));
        }
        if (vop.get(IS_UPDATING + docsId) == null) {
            vop.set(IS_UPDATING + docsId, false);
        }
        System.out.println(docsId + "TIME     " + TimeUnit.MILLISECONDS.convert(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS));
        return patchInfoList;
    }

    private List<PatchInfo> readPatchList(Long docsId, Long snapShotVersion) {
        StreamOperations sop = redisTemplate.opsForStream();
        List<ObjectRecord<String, PatchInfo>> objectRecords = sop
                .read(PatchInfo.class, StreamOffset.create(PATCHES_REDIS + docsId
                        , ReadOffset.from(docsId + "-" + (snapShotVersion - 1))));
        return objectRecords.stream()
                .map(o -> o.getValue())
                .collect(Collectors.toList());
    }

//    private List<PatchInfo> getPatchesList(Docs finalDocs, Long docsId) {
//        checkSyncMap(docsId);
//        checkCachePatched(finalDocs, docsId);
//        synchronized (cachePatches.get(docsId)) {
//            List<PatchInfo> patchInfos = cachePatches.get(docsId).clone();
//            if (finalDocs.getVersion() < patchInfos.getLast().getPatchVersion()) {
//                patchInfos.removeIf(p -> (p.getPatchVersion() < finalDocs.getVersion()));
//            }
//            return patchInfos;
//        }
//    }

    //    private void checkCachePatched(Docs finalDocs, Long docsId) {
//        if (cachePatches.get(docsId) == null) {
//            PatchInfo initPatchInfo = PatchInfo.builder().patchText("").patchVersion(finalDocs.getVersion()).remoteAddress("").build();
//            List<PatchInfo> patchInfos = new ArrayList<>();
//            patchInfos.add(initPatchInfo);
//            cachePatches.putIfAbsent(docsId, patchInfos);
//        }
//    }
//
//    private void checkSyncMap(Long docsId) {
//        if (syncDocs.get(docsId) == null) {
//            syncDocs.putIfAbsent(docsId, false);
//        }
//    }
    private <T> void xAdd(String key, String versionId, T data) throws RedisSystemException {
        StreamOperations sop = redisTemplate.opsForStream();
        ObjectRecord<String, T> record = StreamRecords.newRecord()
                .in(key)
                .withId(versionId)
                .ofObject(data);

        sop.add(record);
    }
}
