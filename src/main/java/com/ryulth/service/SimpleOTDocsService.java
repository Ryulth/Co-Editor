//package com.ryulth.service;
//
//import com.fasterxml.jackson.core.JsonProcessingException;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import com.ryulth.dto.Docs;
//import com.ryulth.pojo.model.Delete;
//import com.ryulth.pojo.model.Insert;
//import com.ryulth.pojo.request.RequestCommand;
//import com.ryulth.pojo.response.Content;
//import com.ryulth.pojo.response.ResponseContent;
//import com.ryulth.pojo.response.ResponseOTContent;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.stereotype.Component;
//
//import java.util.LinkedList;
//import java.util.List;
//import java.util.concurrent.Future;
//
//@Component
//public class SimpleOTDocsService implements OTDocsService {
//
//    private static RequestCommand cacheRequestCommands[] = new RequestCommand[10000];
//    int version = 0;
//
//    @Autowired
//    ObjectMapper mapper;
//
//    @Override
//    public Future<Boolean> saveDocs(Docs docs) {
//        return null;
//    }
//
//    @Override
//    public String transform(RequestCommand requestCommand, String sessionId) {
//        return null;
//    }
//
//    @Override
//    public Docs getDocs(Long id) {
//        Docs docs = new Docs();
//        String contentText = getContentText();
//        docs.setTitle(contentText);
//        docs.setContent(contentText);
//        docs.setId(id);
//        docs.setVersion(Long.valueOf(version));
//        return docs;
//    }
//
//    @Override
//    public synchronized String putDocs(RequestCommand requestCommand) throws JsonProcessingException {
//        Long requestVersion = requestCommand.getCommands().getVersion();
//        List<Content> contentList = new LinkedList<>();
//        RequestCommand cacheRequestCommand;
//        while(requestVersion < version){
//            cacheRequestCommand = cacheRequestCommands[Math.toIntExact(requestVersion)];
//            contentList.add(Content.builder().insertString(cacheRequestCommand.getCommands().getInsert().getText())
//                    .insertPos(cacheRequestCommand.getCommands().getInsert().getIndex())
//                    .insertLength(cacheRequestCommand.getCommands().getInsert().getText().length())
//                    .deleteLength(cacheRequestCommand.getCommands().getDelete().getSize())
//                    .deletePos(cacheRequestCommand.getCommands().getDelete().getIndex())
//                    .sessionId(requestCommand.getSessionId())
//                    .version(requestVersion)
//                    .build());
//            positionIndexing(requestCommand);
//            requestVersion = requestCommand.getCommands().getVersion();
//        }
//
//        cacheRequestCommands[version] = requestCommand;
//        contentList.add(Content.builder().insertString(requestCommand.getCommands().getInsert().getText())
//                .insertPos(requestCommand.getCommands().getInsert().getIndex())
//                .insertLength(requestCommand.getCommands().getInsert().getText().length())
//                .deleteLength(requestCommand.getCommands().getDelete().getSize())
//                .deletePos(requestCommand.getCommands().getDelete().getIndex())
//                .sessionId(requestCommand.getSessionId())
//                .version(requestVersion)
//                .build());
//
//        version++;
////        requestCommand.getCommands().setVersion(Long.valueOf(version));
//
////        String contentText = getContentText();
////
////        Content content = Content.builder().insertString(contentText)
////                .insertPos(0)
////                .insertLength(contentText.length())
////                .deleteLength(0)
////                .deletePos(0)
////                .sessionId(requestCommand.getSessionId())
////                .version(Long.valueOf(version))
////                .build();
//        ResponseOTContent responseContent = ResponseOTContent.builder().contents(contentList).sessionId(requestCommand.getSessionId()).build();
//        System.out.println(responseContent);
//        return mapper.writeValueAsString(responseContent);
//    }
//
//    private void positionIndexing(RequestCommand requestCommand){
//        Long requestVersion = requestCommand.getCommands().getVersion();
//        RequestCommand cacheRequestCommand = cacheRequestCommands[Math.toIntExact(requestVersion)];
//        int cacheInsertIndex = cacheRequestCommand.getCommands().getInsert().getIndex();
//        int cacheDeleteIndex = cacheRequestCommand.getCommands().getDelete().getIndex();
//        int requestInsertIndex = requestCommand.getCommands().getInsert().getIndex();
//        int requestDeleteIndex = requestCommand.getCommands().getInsert().getIndex();
//
//        if(cacheInsertIndex < requestInsertIndex){
//            requestCommand.getCommands().getInsert().setIndex(cacheRequestCommand.getCommands().getInsert().getText().length() + requestInsertIndex);
//        }
//        if(cacheDeleteIndex < requestInsertIndex){
//            requestCommand.getCommands().getInsert().setIndex(cacheRequestCommand.getCommands().getInsert().getText().length() - cacheRequestCommand.getCommands().getDelete().getSize());
//        }
//        if(cacheDeleteIndex < requestDeleteIndex){
//            requestCommand.getCommands().getDelete().setIndex(requestDeleteIndex - cacheRequestCommand.getCommands().getDelete().getSize());
//        }
//        if(cacheInsertIndex < requestDeleteIndex){
//            requestCommand.getCommands().getInsert().setIndex(cacheRequestCommand.getCommands().getInsert().getText().length() + requestDeleteIndex);
//        }
//
//        requestCommand.getCommands().setVersion(requestVersion+1);
//    }
//
//    private String getContentText(){
//        StringBuilder contentText = new StringBuilder();
//        RequestCommand requestCommand;
//        Delete delete;
//        Insert insert;
//
//
//        for(int i = 0; i<version; i++){
//            requestCommand = cacheRequestCommands[i];
//            delete = requestCommand.getCommands().getDelete();
//            insert = requestCommand.getCommands().getInsert();
//            if(delete.getSize() > 0){
//                contentText.delete(delete.getIndex(), delete.getIndex() + delete.getSize());
//            }
//            if(insert.getText().length() > 0){
//                contentText.insert(insert.getIndex(), insert.getText());
//            }
//        }
//        return contentText.toString();
//    }
//}
