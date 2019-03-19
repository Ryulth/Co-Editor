//package com.ryulth.service;
//
//import com.ryulth.pojo.model.Commands;
//import com.ryulth.pojo.model.Delete;
//import com.ryulth.pojo.model.Insert;
//
//import java.util.Objects;
//
//class ContentIndexer {
//
//    static Commands calculateIndex(Commands serverCommand, Commands clientCommand){
//        Commands responseCommand = clientCommand;
//        if(Objects.isNull(serverCommand)){
//            responseCommand.setOriginalLength(responseCommand.getOriginalLength() + clientCommand.getInsert().getText().length());
//            responseCommand.setOriginalLength(responseCommand.getOriginalLength() - clientCommand.getDelete().getSize());
//            return clientCommand;
//        }
//
//        if(serverCommand.getOriginalLength() != clientCommand.getOriginalLength()){
//            if(clientCommand.getDelete().getSize() > 0){
//                responseCommand.setDelete(calculateDeleteIndex(serverCommand.getDelete(), clientCommand.getDelete()));
//                clientCommand.getInsert().setIndex(clientCommand.getInsert().getIndex() - clientCommand.getDelete().getSize());
//            }
//            if(!clientCommand.getInsert().getText().isEmpty()){
//                responseCommand.setInsert(calculateInsertIndex(serverCommand.getInsert(), clientCommand.getInsert()));
//            }
//        }
//
//        responseCommand.setOriginalLength(responseCommand.getOriginalLength() + clientCommand.getInsert().getText().length());
//        responseCommand.setOriginalLength(responseCommand.getOriginalLength() - clientCommand.getDelete().getSize());
//
//        return responseCommand;
//    }
//
//    static private Insert calculateInsertIndex(Insert serverInsert, Insert clientInsert){
//        Insert responseInsert = new Insert();
//        if(serverInsert.getIndex() < clientInsert.getIndex()){
//            responseInsert.setIndex(clientInsert.getIndex()+(clientInsert.getIndex() - serverInsert.getIndex()));
//        }else{
//            responseInsert.setIndex(clientInsert.getIndex());
//        }
//        responseInsert.setText(clientInsert.getText());
//        return responseInsert;
//    }
//
//    static Commands calculateIndex(Commands clientCommand){
//        return calculateIndex(null, clientCommand);
//    }
//
//    static private Delete calculateDeleteIndex(Delete serverDelete, Delete clientDelete){
//        Delete responseDelete = new Delete();
//        if(serverDelete.getIndex() < clientDelete.getIndex()){
//            responseDelete.setIndex(clientDelete.getIndex() - (clientDelete.getIndex() - serverDelete.getIndex()));
//        }
//        responseDelete.setSize(clientDelete.getSize());
//        return responseDelete;
//    }
//}
