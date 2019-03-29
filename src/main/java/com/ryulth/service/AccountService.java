package com.ryulth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ryulth.pojo.model.Account;
import org.springframework.stereotype.Service;

@Service
public interface AccountService {
    void setAccount(Long docsId, Account newAccount);
    String getAccounts(Long docsId) throws JsonProcessingException;
    void  deleteAccount(Long docsId,Account deleteAccount);
}
