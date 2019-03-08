package com.ryulth.pojo.request;

import lombok.Data;

@Data
public class Content {
    public Content(){
    }
    private String insertString;
    private int insertPos;
    private int deleteLength;
    private int deletePos;
    private int originalLength;
}
