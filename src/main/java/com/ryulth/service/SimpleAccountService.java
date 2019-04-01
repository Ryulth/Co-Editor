package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryulth.controller.AccountController;
import com.ryulth.pojo.model.Account;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Component
public class SimpleAccountService implements  AccountService{
    private static Logger logger = LoggerFactory.getLogger(SimpleAccountService.class);
    private final Map<Long, Set<Account>> cacheAccounts = new HashMap<>();
    private final Map<String,Long> cacheSessionTable = new HashMap<>();
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    EditorService editorService;
    @Override
    public void setAccount(Long docsId, Account newAccount) {
        if(cacheAccounts.get(docsId)==null){
            Set<Account> accounts = new HashSet<Account>();
            accounts.add(newAccount);
            cacheAccounts.put(docsId,accounts);
        }
        else {
            cacheAccounts.get(docsId).add(newAccount);
        }
        cacheSessionTable.put(newAccount.getClientSessionId(), docsId);
    }

    @Override
    public String getAccounts(Long docsId) throws JsonProcessingException {
            return objectMapper.writeValueAsString(cacheAccounts.get(docsId));
    }

    @Override
    public String getAccountsBySessionId(String clientSessionId) throws JsonProcessingException {
        Long docsId = cacheSessionTable.get(clientSessionId);
        return objectMapper.writeValueAsString(cacheAccounts.get(docsId));
    }

    @Override
    public Long getDocsId(String clientSessionId) {
        return cacheSessionTable.get(clientSessionId);
    }

    @Override
    public void deleteAccount(String clientSessionId) {
            Long docsId = cacheSessionTable.get(clientSessionId);
            Account deleteAccount = Account.builder().clientSessionId(clientSessionId).remoteAddress("").build();
            cacheAccounts.get(docsId).remove(deleteAccount);
            if(cacheAccounts.get(docsId).size() == 0){
                editorService.patchesAll(docsId);
            }
            cacheSessionTable.remove(clientSessionId);
    }


}
