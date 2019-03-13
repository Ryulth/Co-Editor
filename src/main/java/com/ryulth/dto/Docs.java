package com.ryulth.dto;

import lombok.Data;

import javax.persistence.*;

@Entity
@Data
@Table(name = "docs")
public class Docs {
    @Id
    @GeneratedValue
    private Long id;

    @Column
    private String title;

    @Lob
    @Column(nullable = true)
    private String content;

    @Column
    private Long version;
}
