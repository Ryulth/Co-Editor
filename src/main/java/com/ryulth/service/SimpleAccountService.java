package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryulth.pojo.model.Account;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Component
public class SimpleAccountService implements  AccountService{
    private final Map<Long, Set<Account>> cacheAccounts = new HashMap<>();

    @Autowired
    ObjectMapper objectMapper;
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
    }

    @Override
    public String getAccounts(Long docsId) throws JsonProcessingException {
        return objectMapper.writeValueAsString(cacheAccounts.get(docsId));
    }

    @Override
    public void deleteAccount(Long docsId, Account deleteAccount) {
        cacheAccounts.get(docsId).remove(deleteAccount);
    }
}
