package com.ryulth.service;

import com.ryulth.dto.Docs;
import com.ryulth.pojo.model.PatchInfo;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.Future;

@Service
public interface EditorAsyncService {
    Future<Boolean> updateDocsSnapshot(List<PatchInfo> patchInfos, Docs docs);
}
