package com.ryulth.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.ryulth.pojo.model.Account;
import com.ryulth.service.AccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
public class AccountController {
    private static Logger logger = LoggerFactory.getLogger(AccountController.class);
    @Autowired
    AccountService accountService;
    @Autowired
    SimpMessagingTemplate simpMessagingTemplate;

    @CrossOrigin("*")
    @PostMapping("/docs/{docsId}/accounts")
    public void docsLogin(@PathVariable Long docsId, @RequestBody Account account, HttpServletRequest request) throws JsonProcessingException {
        account.setRemoteAddress(request.getRemoteAddr());
        accountService.setAccount(docsId, account);
        this.simpMessagingTemplate.convertAndSend("/topic/docs/" + docsId + "/accounts",
                accountService.getAccounts(docsId));
    }

    @CrossOrigin("*")
    @GetMapping("/docs/{docsId}/accounts")
    public String docsAccounts(@PathVariable Long docsId) throws JsonProcessingException {
        return accountService.getAccounts(docsId);
    }

    @EventListener
    @Async
    public void handleWebsocketDisconnectListner(SessionDisconnectEvent event) throws JsonProcessingException {
        StompHeaderAccessor sha = StompHeaderAccessor.wrap(event.getMessage());
        Long docsId = accountService.getDocsId(sha.getSessionId());
        accountService.deleteAccount(sha.getSessionId());
        this.simpMessagingTemplate.convertAndSend("/topic/docs/" + docsId + "/accounts",
                accountService.getAccounts(docsId));
    }

    @Autowired
    private RedisTemplate redisTemplate;
    private int temp = 0;

    @GetMapping("/redisTest")
    public void redisTest() {
        ValueOperations vop = redisTemplate.opsForValue();
        ListOperations lop = redisTemplate.opsForList();
        List a = lop.range("test", 1, 200);
        System.out.println(a);
        vop.set("jdkSerial", "jdk");
        temp += 1;
        lop.rightPush("test", temp);
        String result = (String) vop.get("jdkSerial");
        int result2 = (int) lop.index("test", -1);
        System.out.println(result);//jdk
        System.out.println(result2);//jdk
        System.out.println(lop.size("test"));
        Account account = Account.builder().clientSessionId("sessionid").remoteAddress(String.valueOf(temp)).build();
        lop.rightPush("account", account);
        Account account2 = (Account) lop.index("account", -1);
        List<Account> accounts = lop.range("account", 1, 200);
        System.out.println(account2);
        System.out.println(accounts);
        System.out.println(accounts.get(0).getClientSessionId());
    }
}
