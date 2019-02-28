package com.ryulth.repository;

import com.ryulth.dto.Docs;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocsRepository extends CrudRepository<Docs, Long> {
    List<Docs> findByTitle(String title);
}
