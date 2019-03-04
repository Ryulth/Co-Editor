package com.ryulth.dto;

import lombok.Data;

@Data
public class Content {
    public Content(){
    }
    private String type;
    private String text;
    private int position;
}
