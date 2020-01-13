package org.pmiops.workbench.db.dao;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.pmiops.workbench.db.model.DbStorageEnums;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.db.model.DbWorkspace.BillingMigrationStatus;
import org.pmiops.workbench.model.BillingStatus;
import org.pmiops.workbench.model.DataAccessLevel;
import org.pmiops.workbench.model.WorkspaceActiveStatus;
import org.pmiops.workbench.utils.DaoUtils;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

/**
 * Declaration of automatic query methods for Workspaces. The methods declared here are
 * automatically interpreted by Spring Data (see README).
 *
 * <p>Use of @Query is discouraged; if desired, define aliases in WorkspaceService.
 */
public interface WorkspaceDao extends CrudRepository<DbWorkspace, Long> {

  DbWorkspace findByWorkspaceNamespaceAndFirecloudNameAndActiveStatus(
      String workspaceNamespace, String firecloudName, short activeStatus);

  DbWorkspace findByWorkspaceNamespaceAndNameAndActiveStatus(
      String workspaceNamespace, String name, short activeStatus);

  @Query("SELECT distinct w.workspaceNamespace, w from DbWorkspace w")
  Set<String> findAllWorkspaceNamespaces();

  @Query(
      "SELECT w FROM DbWorkspace w LEFT JOIN FETCH w.cohorts c LEFT JOIN FETCH c.cohortReviews"
          + " WHERE w.workspaceNamespace = (:ns) AND w.firecloudName = (:fcName)"
          + " AND w.activeStatus = (:status)")
  DbWorkspace findByFirecloudNameAndActiveStatusWithEagerCohorts(
      @Param("ns") String workspaceNamespace,
      @Param("fcName") String fcName,
      @Param("status") short status);

  List<DbWorkspace> findByApprovedIsNullAndReviewRequestedTrueOrderByTimeRequested();

  List<DbWorkspace> findAllByFirecloudUuidIn(Collection<String> firecloudUuids);

  List<DbWorkspace> findAllByWorkspaceIdIn(Collection<Long> dbIds);

  List<DbWorkspace> findAllByWorkspaceNamespace(String workspaceNamespace);

  List<DbWorkspace> findAllByBillingMigrationStatus(Short billingMigrationStatus);

  Set<DbWorkspace> findAllByCreator(DbUser user);

  default List<DbWorkspace> findAllByBillingMigrationStatus(BillingMigrationStatus status) {
    return findAllByBillingMigrationStatus(DbStorageEnums.billingMigrationStatusToStorage(status));
  }

  default void updateBillingStatus(long workspaceId, BillingStatus status) {
    DbWorkspace toUpdate = findOne(workspaceId);
    toUpdate.setBillingStatus(status);
    save(toUpdate);
  }

  @Query("SELECT w.creator FROM DbWorkspace w WHERE w.billingStatus = (:status)")
  Set<DbUser> findAllCreatorsByBillingStatus(@Param("status") BillingStatus status);

  default Map<WorkspaceActiveStatus, Long> getActiveStatusToCountMap() {
    return DaoUtils.getAttributeToCountMap(findAll(), DbWorkspace::getWorkspaceActiveStatusEnum);
  }

  default Map<DataAccessLevel, Long> getDataAccessLevelToCountMap() {
    return DaoUtils.getAttributeToCountMap(findAll(), DbWorkspace::getDataAccessLevelEnum);
  }
}
