package com.ryulth.service;

import com.ryulth.dto.Docs;
import org.springframework.stereotype.Service;

@Service
public interface DocsService {
    Boolean saveDocs(Docs docs);
}
