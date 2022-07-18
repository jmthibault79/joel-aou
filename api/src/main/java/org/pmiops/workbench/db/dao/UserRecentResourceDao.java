package org.pmiops.workbench.db.dao;

import org.pmiops.workbench.db.model.DbCohort;
import org.pmiops.workbench.db.model.DbConceptSet;
import org.pmiops.workbench.db.model.DbUserRecentResource;
import org.springframework.data.repository.CrudRepository;

// This DAO will be replaced by UserRecentlyModifiedResourceDao
@Deprecated
public interface UserRecentResourceDao extends CrudRepository<DbUserRecentResource, Long> {

  DbUserRecentResource findTopByUserIdOrderByLastAccessDate(long userId);

  DbUserRecentResource findByUserIdAndWorkspaceIdAndCohort(
      long userId, long workspaceId, DbCohort cohort);

  DbUserRecentResource findByUserIdAndWorkspaceIdAndNotebookName(
      long userId, long workspaceId, String notebookPath);

  DbUserRecentResource findByUserIdAndWorkspaceIdAndConceptSet(
      long userId, long workspaceId, DbConceptSet conceptSet);
}
