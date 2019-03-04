package com.ryulth.service;

import com.ryulth.dto.Docs;
import org.springframework.stereotype.Service;

import java.util.concurrent.Future;

@Service
public interface DocsService {
    Future<Boolean> updateDocs(Docs docs);

}
