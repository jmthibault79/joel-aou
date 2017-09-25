package org.pmiops.workbench.api;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.Random;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import javax.inject.Provider;
import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.CdrVersion;
import org.pmiops.workbench.db.model.User;
import org.pmiops.workbench.db.model.Workspace.FirecloudWorkspaceId;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.exceptions.NotFoundException;
import org.pmiops.workbench.exceptions.ServerErrorException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.model.DataAccessLevel;
import org.pmiops.workbench.model.ResearchPurpose;
import org.pmiops.workbench.model.Workspace;
import org.pmiops.workbench.model.Workspace.DataAccessLevelEnum;
import org.pmiops.workbench.model.WorkspaceListResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WorkspaceController implements WorkspacesApiDelegate {

  private static final Logger log = Logger.getLogger(WorkspaceController.class.getName());

  private static final String WORKSPACE_NAMESPACE_PREFIX = "allofus-";
  private static final String RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz";
  private static final int NUM_RANDOM_CHARS = 20;

  // Converter functions between backend representation (used with Hibernate) and
  // client representation (generated by Swagger).
  private static final Function<org.pmiops.workbench.db.model.Workspace, Workspace>
      TO_CLIENT_WORKSPACE =
      new Function<org.pmiops.workbench.db.model.Workspace, Workspace>() {
        @Override
        public Workspace apply(org.pmiops.workbench.db.model.Workspace workspace) {
          FirecloudWorkspaceId workspaceId = workspace.getFirecloudWorkspaceId();
          ResearchPurpose researchPurpose = new ResearchPurpose()
              .diseaseFocusedResearch(workspace.getDiseaseFocusedResearch())
              .diseaseOfFocus(workspace.getDiseaseOfFocus())
              .methodsDevelopment(workspace.getMethodsDevelopment())
              .controlSet(workspace.getControlSet())
              .aggregateAnalysis(workspace.getAggregateAnalysis())
              .ancestry(workspace.getAncestry())
              .commercialPurpose(workspace.getCommercialPurpose())
              .population(workspace.getPopulation())
              .populationOfFocus(workspace.getPopulationOfFocus())
              .additionalNotes(workspace.getAdditionalNotes());
          Workspace result = new Workspace()
              .lastModifiedTime(new DateTime(workspace.getLastModifiedTime(), DateTimeZone.UTC))
              .creationTime(new DateTime(workspace.getCreationTime(), DateTimeZone.UTC))
              .dataAccessLevel(DataAccessLevelEnum.fromValue(
                  workspace.getDataAccessLevel().toString()))
              .name(workspace.getName())
              .id(workspaceId.getWorkspaceName())
              .namespace(workspaceId.getWorkspaceNamespace())
              .description(workspace.getDescription())
              .researchPurpose(researchPurpose);
          if (workspace.getCreator() != null) {
            result.setCreator(workspace.getCreator().getEmail());
          }
          if (workspace.getCdrVersion() != null) {
            result.setCdrVersionId(String.valueOf(workspace.getCdrVersion().getCdrVersionId()));
          }
          return result;
        }
      };

  private static final Function<Workspace, org.pmiops.workbench.db.model.Workspace>
      FROM_CLIENT_WORKSPACE =
      new Function<Workspace, org.pmiops.workbench.db.model.Workspace>() {
        @Override
        public org.pmiops.workbench.db.model.Workspace apply(Workspace workspace) {
          org.pmiops.workbench.db.model.Workspace result = new org.pmiops.workbench.db.model.Workspace();
          result.setDataAccessLevel(
              DataAccessLevel.fromValue(workspace.getDataAccessLevel().toString()));
          result.setDescription(workspace.getDescription());
          result.setName(workspace.getName());
          return result;
        }
      };


  private final WorkspaceDao workspaceDao;
  private final CdrVersionDao cdrVersionDao;
  private final Provider<User> userProvider;
  private final FireCloudService fireCloudService;
  private final Clock clock;

  @Autowired
  WorkspaceController(WorkspaceDao workspaceDao, CdrVersionDao cdrVersionDao,
      Provider<User> userProvider, FireCloudService fireCloudService, Clock clock) {
    this.workspaceDao = workspaceDao;
    this.cdrVersionDao = cdrVersionDao;
    this.userProvider = userProvider;
    this.fireCloudService = fireCloudService;
    this.clock = clock;
  }

  private static String generateRandomChars(String candidateChars, int length) {
    StringBuilder sb = new StringBuilder();
    Random random = new Random();
    for (int i = 0; i < length; i++) {
      sb.append(candidateChars.charAt(random.nextInt(candidateChars.length())));
    }
    return sb.toString();
  }

  private void setCdrVersionId(Workspace workspace,
      org.pmiops.workbench.db.model.Workspace dbWorkspace) {
    if (workspace.getCdrVersionId() != null) {
      try {
        CdrVersion cdrVersion = cdrVersionDao.findOne(Long.parseLong(workspace.getCdrVersionId()));
        if (cdrVersion == null) {
          throw new BadRequestException("CDR version with ID {0} not found"
              .format(workspace.getCdrVersionId()));
        }
        dbWorkspace.setCdrVersion(cdrVersion);
      } catch (NumberFormatException e) {
        throw new BadRequestException("Invalid cdr version ID: {0}"
            .format(workspace.getCdrVersionId()));
      }
    }
  }

  private FirecloudWorkspaceId generateFirecloudWorkspaceId(String namespace, String name) {
    // Find a unique workspace namespace based off of the provided name.
    String strippedName = name.toLowerCase().replaceAll("[^0-9a-z]", "");
    // If the stripped name has no chars, generate a random name.
    if (strippedName.isEmpty()) {
      strippedName = generateRandomChars(RANDOM_CHARS, NUM_RANDOM_CHARS);
    }
    return new FirecloudWorkspaceId(namespace, strippedName);
  }

  @Override
  public ResponseEntity<Workspace> createWorkspace(Workspace workspace) {
    FirecloudWorkspaceId workspaceId = generateFirecloudWorkspaceId(workspace.getNamespace(),
        workspace.getName());
    org.pmiops.workbench.db.model.Workspace existingWorkspace =
        getDbWorkspace(workspaceId.getWorkspaceNamespace(), workspaceId.getWorkspaceName());
    if (existingWorkspace != null) {
      throw new BadRequestException("Workspace {0}/{1} already exists".format(
          workspaceId.getWorkspaceNamespace(), workspaceId.getWorkspaceName()));
    }
    try {
      fireCloudService.createWorkspace(workspaceId.getWorkspaceNamespace(),
          workspaceId.getWorkspaceName());
    } catch (org.pmiops.workbench.firecloud.ApiException e) {
      log.log(Level.SEVERE, "Error creating FC workspace {0}/{1}: {2} ".format(
          workspaceId.getWorkspaceNamespace(), workspaceId.getWorkspaceName(), e.getResponseBody()),
          e);
      // TODO: figure out what happens if the workspace already exists
      throw new ServerErrorException("Error creating FC workspace", e);
    }
    Timestamp now = new Timestamp(clock.instant().toEpochMilli());
    // TODO: enforce data access level authorization
    org.pmiops.workbench.db.model.Workspace dbWorkspace = FROM_CLIENT_WORKSPACE.apply(workspace);
    dbWorkspace.setCreator(userProvider.get());
    dbWorkspace.setCreationTime(now);
    dbWorkspace.setLastModifiedTime(now);
    dbWorkspace.setFirecloudName(workspaceId.getWorkspaceName());
    dbWorkspace.setWorkspaceNamespace(workspaceId.getWorkspaceNamespace());
    dbWorkspace.setDiseaseFocusedResearch(workspace.getResearchPurpose().getDiseaseFocusedResearch());
    dbWorkspace.setDiseaseOfFocus(workspace.getResearchPurpose().getDiseaseOfFocus());
    dbWorkspace.setMethodsDevelopment(workspace.getResearchPurpose().getMethodsDevelopment());
    dbWorkspace.setControlSet(workspace.getResearchPurpose().getControlSet());
    dbWorkspace.setAggregateAnalysis(workspace.getResearchPurpose().getAggregateAnalysis());
    dbWorkspace.setAncestry(workspace.getResearchPurpose().getAncestry());
    dbWorkspace.setCommercialPurpose(workspace.getResearchPurpose().getCommercialPurpose());
    dbWorkspace.setPopulation(workspace.getResearchPurpose().getPopulation());
    dbWorkspace.setPopulationOfFocus(workspace.getResearchPurpose().getPopulationOfFocus());
    dbWorkspace.setAdditionalNotes(workspace.getResearchPurpose().getAdditionalNotes());
    setCdrVersionId(workspace, dbWorkspace);
    dbWorkspace = workspaceDao.save(dbWorkspace);
    return ResponseEntity.ok(TO_CLIENT_WORKSPACE.apply(dbWorkspace));
  }

  @Override
  public ResponseEntity<Void> deleteWorkspace(String workspaceNamespace, String workspaceId) {
    org.pmiops.workbench.db.model.Workspace dbWorkspace = getDbWorkspaceCheckExists(
        workspaceNamespace, workspaceId);
    workspaceDao.delete(dbWorkspace);
    return ResponseEntity.ok(null);
  }

  @Override
  public ResponseEntity<Workspace> getWorkspace(String workspaceNamespace, String workspaceId) {
    org.pmiops.workbench.db.model.Workspace dbWorkspace = getDbWorkspaceCheckExists(
        workspaceNamespace, workspaceId);
    return ResponseEntity.ok(TO_CLIENT_WORKSPACE.apply(dbWorkspace));
  }

  @Override
  public ResponseEntity<WorkspaceListResponse> getWorkspaces() {
    // TODO: use FireCloud to determine what workspaces to return, instead of just returning
    // workspaces created by this user.
    List<org.pmiops.workbench.db.model.Workspace> workspaces =
        workspaceDao.findByCreatorOrderByNameAsc(userProvider.get());
    WorkspaceListResponse response = new WorkspaceListResponse();
    response.setItems(workspaces.stream().map(TO_CLIENT_WORKSPACE).collect(Collectors.toList()));
    return ResponseEntity.ok(response);
  }

  @Override
  public ResponseEntity<Workspace> updateWorkspace(String workspaceNamespace, String workspaceId,
      Workspace workspace) {
    org.pmiops.workbench.db.model.Workspace dbWorkspace = getDbWorkspaceCheckExists(
        workspaceNamespace, workspaceId);
    if (workspace.getDataAccessLevel() != null) {
      dbWorkspace.setDataAccessLevel(
          DataAccessLevel.fromValue(workspace.getDataAccessLevel().name()));
    }
    if (workspace.getDescription() != null) {
      dbWorkspace.setDescription(workspace.getDescription());
    }
    if (workspace.getName() != null) {
      dbWorkspace.setName(workspace.getName());
    }
    // TODO: handle research purpose
    setCdrVersionId(workspace, dbWorkspace);
    Timestamp now = new Timestamp(clock.instant().toEpochMilli());
    dbWorkspace.setLastModifiedTime(now);
    // TODO: add version, check it here
    dbWorkspace = workspaceDao.save(dbWorkspace);
    return ResponseEntity.ok(TO_CLIENT_WORKSPACE.apply(dbWorkspace));
  }

  private org.pmiops.workbench.db.model.Workspace getDbWorkspace(String workspaceNamespace,
      String firecloudName) {
    return workspaceDao.findByWorkspaceNamespaceAndFirecloudName(workspaceNamespace, firecloudName);
  }

  private org.pmiops.workbench.db.model.Workspace getDbWorkspaceCheckExists(
      String workspaceNamespace, String workspaceId) {
    org.pmiops.workbench.db.model.Workspace workspace = getDbWorkspace(workspaceNamespace,
        workspaceId);
    if (workspace == null) {
      throw new NotFoundException("Workspace {0}/{1} not found".format(workspaceNamespace,
          workspaceId));
    }
    return workspace;
  }
}
