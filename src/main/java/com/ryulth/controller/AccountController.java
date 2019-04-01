package com.ryulth.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ryulth.pojo.model.Account;
import com.ryulth.service.AccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

@RestController
public class AccountController {
    @Autowired
    AccountService accountService;
    @CrossOrigin("*")
    @PostMapping("/docs/{docsId}/accounts")
    public void docsLogin(@PathVariable Long docsId, @RequestBody Account account , HttpServletRequest request){
        account.setRemoteAddress(request.getRemoteAddr());
        accountService.setAccount(docsId,account);
    }
    @CrossOrigin("*")
    @GetMapping("/docs/{docsId}/accounts")
    public String docsAccounts(@PathVariable Long docsId) throws JsonProcessingException {
        return accountService.getAccounts(docsId);
    }
    @CrossOrigin("*")
    @DeleteMapping("/docs/{docsId}/accounts/{clientSessionId}")
    public void docsLogout(@PathVariable("docsId") Long docsId,@PathVariable("clientSessionId") String clientSessionId, HttpServletRequest request){
        Account deleteAccount = Account.builder().clientSessionId(clientSessionId).remoteAddress(request.getRemoteAddr()).build();
        accountService.deleteAccount(docsId,deleteAccount);
    }
}
