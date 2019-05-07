package com.ryulth.service;

import com.ryulth.dto.Docs;
import com.ryulth.pojo.model.PatchInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.AsyncResult;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Future;

@Component
@EnableAsync
public class SimpleEditorAsyncService implements EditorAsyncService {
    private static Logger logger = LoggerFactory.getLogger(SimpleEditorAsyncService.class);

    private final static diff_match_patch dmp = new diff_match_patch();

    //TODO 데이터 업데이트 요망
    @Override
    @Async
    public Future<Boolean> updateDocsSnapshot(List<PatchInfo> patchInfos, Docs docs) {
        logger.info("스냅샷 시작");
        String result = docs.getContent();
        Long lastVersion = docs.getVersion();
        for (PatchInfo patchInfo :patchInfos ) {
            if(docs.getVersion()<patchInfo.getPatchVersion()) {
                LinkedList<diff_match_patch.Patch> patches = (LinkedList<diff_match_patch.Patch>) dmp.patch_fromText(patchInfo.getPatchText());
                Object[] results = dmp.patch_apply(patches, result);
                result = String.valueOf(results[0]);
                lastVersion = patchInfo.getPatchVersion();
            }
        }
        synchronized (docs){
            docs.setVersion(lastVersion);
            docs.setContent(result);
        }
        synchronized (patchInfos) {
            Long finalLastVersion = lastVersion;
            patchInfos.removeIf(p->(p.getPatchVersion()< finalLastVersion));
        }
        logger.info("스냅샷 끝");
        return new AsyncResult<Boolean>(true);
    }
}
