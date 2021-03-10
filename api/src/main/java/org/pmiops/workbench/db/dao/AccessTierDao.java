package org.pmiops.workbench.db.dao;

import java.util.List;
import org.pmiops.workbench.db.model.DbAccessTier;
import org.springframework.data.repository.CrudRepository;

public interface AccessTierDao extends CrudRepository<DbAccessTier, Long> {
  List<DbAccessTier> findAll();

  DbAccessTier findOneByShortName(String shortName);
}
