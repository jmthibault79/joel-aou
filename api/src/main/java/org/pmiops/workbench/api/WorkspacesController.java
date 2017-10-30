package org.pmiops.workbench.api;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import javax.inject.Provider;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import org.pmiops.workbench.annotations.AuthorityRequired;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.dao.WorkspaceService;
import org.pmiops.workbench.db.model.CdrVersion;
import org.pmiops.workbench.db.model.User;
import org.pmiops.workbench.db.model.Workspace.FirecloudWorkspaceId;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.exceptions.ServerErrorException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.model.Authority;
import org.pmiops.workbench.model.DataAccessLevel;
import org.pmiops.workbench.model.EmptyResponse;
import org.pmiops.workbench.model.ResearchPurpose;
import org.pmiops.workbench.model.ResearchPurposeReviewRequest;
import org.pmiops.workbench.model.Workspace;
import org.pmiops.workbench.model.Workspace.DataAccessLevelEnum;
import org.pmiops.workbench.model.WorkspaceListResponse;


@RestController
public class WorkspacesController implements WorkspacesApiDelegate {

  private static final Logger log = Logger.getLogger(WorkspacesController.class.getName());

  private static final String WORKSPACE_NAMESPACE_PREFIX = "allofus-";
  private static final String RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz";
  private static final int NUM_RANDOM_CHARS = 20;

  /**
   * Converter function from backend representation (used with Hibernate) to
   * client representation (generated by Swagger).
   */
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
              .additionalNotes(workspace.getAdditionalNotes())
              .reviewRequested(workspace.getReviewRequested())
              .approved(workspace.getApproved());

          if(workspace.getTimeRequested() != null){
            researchPurpose.timeRequested(workspace.getTimeRequested().getTime());
          }

          if(workspace.getTimeReviewed() != null){
            researchPurpose.timeReviewed(workspace.getTimeReviewed().getTime());
          }
          Workspace result = new Workspace()
              .lastModifiedTime(workspace.getLastModifiedTime().getTime())
              .creationTime(workspace.getCreationTime().getTime())
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
          result.setDiseaseFocusedResearch(workspace.getResearchPurpose().getDiseaseFocusedResearch());
          result.setDiseaseOfFocus(workspace.getResearchPurpose().getDiseaseOfFocus());
          result.setMethodsDevelopment(workspace.getResearchPurpose().getMethodsDevelopment());
          result.setControlSet(workspace.getResearchPurpose().getControlSet());
          result.setAggregateAnalysis(workspace.getResearchPurpose().getAggregateAnalysis());
          result.setAncestry(workspace.getResearchPurpose().getAncestry());
          result.setCommercialPurpose(workspace.getResearchPurpose().getCommercialPurpose());
          result.setPopulation(workspace.getResearchPurpose().getPopulation());
          result.setPopulationOfFocus(workspace.getResearchPurpose().getPopulationOfFocus());
          result.setAdditionalNotes(workspace.getResearchPurpose().getAdditionalNotes());
          result.setReviewRequested(workspace.getResearchPurpose().getReviewRequested());
          if(workspace.getResearchPurpose().getTimeRequested() != null){
            result.setTimeRequested(new Timestamp(workspace.getResearchPurpose().getTimeRequested()));
          }
          result.setApproved(workspace.getResearchPurpose().getApproved());
          if(workspace.getResearchPurpose().getTimeReviewed() != null){
            result.setTimeReviewed(new Timestamp(workspace.getResearchPurpose().getTimeReviewed()));
          }
          return result;
        }
      };


  private final WorkspaceService workspaceService;
  private final CdrVersionDao cdrVersionDao;
  private final Provider<User> userProvider;
  private final FireCloudService fireCloudService;
  private final Clock clock;

  @Autowired
  WorkspacesController(
      WorkspaceService workspaceService,
      CdrVersionDao cdrVersionDao,
      Provider<User> userProvider,
      FireCloudService fireCloudService,
      Clock clock) {
    this.workspaceService = workspaceService;
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
          throw new BadRequestException(
              String.format("CDR version with ID %s not found", workspace.getCdrVersionId()));
        }
        dbWorkspace.setCdrVersion(cdrVersion);
      } catch (NumberFormatException e) {
        throw new BadRequestException(String.format(
            "Invalid cdr version ID: %s", workspace.getCdrVersionId()));
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
    if (workspace.getName().equals("")) {
      throw new BadRequestException("Cannot create a workspace with no name.");
    }
    User user = userProvider.get();
    if (user == null) {
      // You won't be able to create workspaces prior to creating a user record once our
      // registration flow is done, so this should never happen.
      throw new BadRequestException("User is not initialized yet; please register");
    }
    FirecloudWorkspaceId workspaceId = generateFirecloudWorkspaceId(workspace.getNamespace(),
        workspace.getName());
    org.pmiops.workbench.db.model.Workspace existingWorkspace = workspaceService.get(
        workspaceId.getWorkspaceNamespace(), workspaceId.getWorkspaceName());
    if (existingWorkspace != null) {
      throw new BadRequestException(String.format(
          "Workspace %s/%s already exists",
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
    dbWorkspace.setFirecloudName(workspaceId.getWorkspaceName());
    dbWorkspace.setWorkspaceNamespace(workspaceId.getWorkspaceNamespace());
    dbWorkspace.setCreator(user);
    dbWorkspace.setCreationTime(now);
    dbWorkspace.setLastModifiedTime(now);
    setCdrVersionId(workspace, dbWorkspace);
    dbWorkspace = workspaceService.dao.save(dbWorkspace);
    return ResponseEntity.ok(TO_CLIENT_WORKSPACE.apply(dbWorkspace));
  }

  @Override
  public ResponseEntity<Void> deleteWorkspace(String workspaceNamespace, String workspaceId) {
    org.pmiops.workbench.db.model.Workspace dbWorkspace = workspaceService.getRequired(
        workspaceNamespace, workspaceId);
    workspaceService.dao.delete(dbWorkspace);
    return ResponseEntity.ok(null);
  }

  @Override
  public ResponseEntity<Workspace> getWorkspace(String workspaceNamespace, String workspaceId) {
    org.pmiops.workbench.db.model.Workspace dbWorkspace = workspaceService.getRequired(
        workspaceNamespace, workspaceId);
    return ResponseEntity.ok(TO_CLIENT_WORKSPACE.apply(dbWorkspace));
  }

  @Override
  public ResponseEntity<WorkspaceListResponse> getWorkspaces() {
    // TODO: use FireCloud to determine what workspaces to return, instead of just returning
    // workspaces created by this user.
    User user = userProvider.get();
    List<org.pmiops.workbench.db.model.Workspace> workspaces;
    if (user == null) {
      workspaces = new ArrayList<>();
    } else {
      workspaces = workspaceService.dao.findByCreatorOrderByNameAsc(userProvider.get());
    }
    WorkspaceListResponse response = new WorkspaceListResponse();
    response.setItems(workspaces.stream().map(TO_CLIENT_WORKSPACE).collect(Collectors.toList()));
    return ResponseEntity.ok(response);
  }

  @Override
  public ResponseEntity<Workspace> updateWorkspace(String workspaceNamespace, String workspaceId,
      Workspace workspace) {
    org.pmiops.workbench.db.model.Workspace dbWorkspace = workspaceService.getRequired(
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
    dbWorkspace = workspaceService.dao.save(dbWorkspace);
    return ResponseEntity.ok(TO_CLIENT_WORKSPACE.apply(dbWorkspace));
  }

  /** Record approval or rejection of research purpose. */
  @AuthorityRequired({Authority.REVIEW_RESEARCH_PURPOSE})
  public ResponseEntity<EmptyResponse> reviewWorkspace(
      String ns, String id, ResearchPurposeReviewRequest review) {
    workspaceService.setResearchPurposeApproved(ns, id, review.getApproved());
    return ResponseEntity.ok(new EmptyResponse());
  }


  // Note we do not paginate the workspaces list, since we expect few workspaces
  // to require review.
  //
  // We can add pagination in the DAO by returning Slice<Workspace> if we want the method to return
  // pagination information (e.g. are there more workspaces to get), and Page<Workspace> if we
  // want the method to return both pagination information and a total count.
  @AuthorityRequired({Authority.REVIEW_RESEARCH_PURPOSE})
  public ResponseEntity<WorkspaceListResponse> getWorkspacesForReview() {
    WorkspaceListResponse response = new WorkspaceListResponse();
    List<org.pmiops.workbench.db.model.Workspace> workspaces = workspaceService.findForReview();
    response.setItems(workspaces.stream().map(TO_CLIENT_WORKSPACE).collect(Collectors.toList()));
    return ResponseEntity.ok(response);
  }
}
