package org.pmiops.workbench.workspaceadmin;

import static com.google.common.truth.Truth.assertThat;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.pmiops.workbench.db.dao.CohortDao;
import org.pmiops.workbench.db.dao.ConceptSetDao;
import org.pmiops.workbench.db.dao.DataSetDao;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.DbStorageEnums;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspace;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.google.CloudStorageService;
import org.pmiops.workbench.model.AdminFederatedWorkspaceDetailsResponse;
import org.pmiops.workbench.model.AdminWorkspaceCloudStorageCounts;
import org.pmiops.workbench.model.AdminWorkspaceObjectsCounts;
import org.pmiops.workbench.model.AdminWorkspaceResources;
import org.pmiops.workbench.model.ClusterStatus;
import org.pmiops.workbench.model.ListClusterResponse;
import org.pmiops.workbench.model.ResearchPurpose;
import org.pmiops.workbench.model.UserRole;
import org.pmiops.workbench.model.Workspace;
import org.pmiops.workbench.model.WorkspaceAccessLevel;
import org.pmiops.workbench.notebooks.LeonardoNotebooksClient;
import org.pmiops.workbench.notebooks.NotebooksService;
import org.pmiops.workbench.utils.TestMockFactory;
import org.pmiops.workbench.utils.WorkspaceMapperImpl;
import org.pmiops.workbench.workspaces.WorkspaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@DataJpaTest
public class WorkspaceAdminControllerTest {
  @Autowired private FireCloudService mockFirecloudService;
  @Autowired private LeonardoNotebooksClient mockLeonardoNotebooksClient;
  @Autowired private WorkspaceAdminController workspaceAdminController;
  @Autowired private WorkspaceAdminService mockWorkspaceAdminService;
  @Autowired private WorkspaceService mockWorkspaceService;

  private static final String WORKSPACE_NAMESPACE = "namespace";
  private static final String NONSENSE_NAMESPACE = "wharrgarbl_wharrgarbl";
  private static final String WORKSPACE_NAME = "name";

  @TestConfiguration
  @Import({WorkspaceAdminController.class, WorkspaceMapperImpl.class})
  @MockBean({
    CloudStorageService.class,
    CohortDao.class,
    ConceptSetDao.class,
    DataSetDao.class,
    FireCloudService.class,
    LeonardoNotebooksClient.class,
    NotebooksService.class,
    WorkspaceAdminService.class,
    WorkspaceDao.class,
    WorkspaceService.class
  })
  static class Configuration {}

  @Before
  public void setUp() {
    TestMockFactory testMockFactory = new TestMockFactory();

    when(mockWorkspaceAdminService.getFirstWorkspaceByNamespace(NONSENSE_NAMESPACE))
        .thenReturn(Optional.empty());

    Workspace workspace = testMockFactory.createWorkspace(WORKSPACE_NAMESPACE, WORKSPACE_NAME);
    DbWorkspace dbWorkspace = createDbWorkspaceStub(workspace);
    when(mockWorkspaceAdminService.getFirstWorkspaceByNamespace(WORKSPACE_NAMESPACE))
        .thenReturn(Optional.of(dbWorkspace));

    UserRole collaborator =
        new UserRole().email("test@test.test").role(WorkspaceAccessLevel.WRITER);
    List<UserRole> collaborators = new ArrayList<>();
    collaborators.add(collaborator);
    when(mockWorkspaceService.getFirecloudUserRoles(WORKSPACE_NAMESPACE, WORKSPACE_NAME))
        .thenReturn(collaborators);

    AdminWorkspaceObjectsCounts objectsCounts =
        new AdminWorkspaceObjectsCounts().cohortCount(1).conceptSetCount(2).datasetCount(3);
    when(mockWorkspaceAdminService.getAdminWorkspaceObjects(dbWorkspace.getWorkspaceId()))
        .thenReturn(objectsCounts);

    AdminWorkspaceCloudStorageCounts cloudStorageCounts =
        new AdminWorkspaceCloudStorageCounts()
            .notebookFileCount(1)
            .nonNotebookFileCount(2)
            .storageBytesUsed(123456789L);
    when(mockWorkspaceAdminService.getAdminWorkspaceCloudStorageCounts(
            WORKSPACE_NAMESPACE, dbWorkspace.getFirecloudName()))
        .thenReturn(cloudStorageCounts);

    org.pmiops.workbench.notebooks.model.ListClusterResponse listClusterResponse =
        testMockFactory.createFcListClusterResponse();
    List<org.pmiops.workbench.notebooks.model.ListClusterResponse> clusters = new ArrayList<>();
    clusters.add(listClusterResponse);
    when(mockLeonardoNotebooksClient.listClustersByProjectAsAdmin(WORKSPACE_NAMESPACE))
        .thenReturn(clusters);

    FirecloudWorkspace fcWorkspace =
        testMockFactory.createFcWorkspace(WORKSPACE_NAMESPACE, WORKSPACE_NAME, "test");
    FirecloudWorkspaceResponse fcWorkspaceResponse =
        new FirecloudWorkspaceResponse().workspace(fcWorkspace);
    when(mockFirecloudService.getWorkspace(WORKSPACE_NAMESPACE, TestMockFactory.BUCKET_NAME))
        .thenReturn(fcWorkspaceResponse);
  }

  @Test
  public void getFederatedWorkspaceDetails() {
    ResponseEntity<AdminFederatedWorkspaceDetailsResponse> response =
        workspaceAdminController.getFederatedWorkspaceDetails(WORKSPACE_NAMESPACE);
    assertThat(response.getStatusCodeValue()).isEqualTo(200);

    AdminFederatedWorkspaceDetailsResponse workspaceDetailsResponse = response.getBody();
    assertThat(workspaceDetailsResponse.getWorkspace().getNamespace())
        .isEqualTo(WORKSPACE_NAMESPACE);
    assertThat(workspaceDetailsResponse.getWorkspace().getName()).isEqualTo(WORKSPACE_NAME);

    AdminWorkspaceResources resources = workspaceDetailsResponse.getResources();
    AdminWorkspaceObjectsCounts objectsCounts = resources.getWorkspaceObjects();
    assertThat(objectsCounts.getCohortCount()).isEqualTo(1);
    assertThat(objectsCounts.getConceptSetCount()).isEqualTo(2);
    assertThat(objectsCounts.getDatasetCount()).isEqualTo(3);

    AdminWorkspaceCloudStorageCounts cloudStorageCounts = resources.getCloudStorage();
    assertThat(cloudStorageCounts.getNotebookFileCount()).isEqualTo(1);
    assertThat(cloudStorageCounts.getNonNotebookFileCount()).isEqualTo(2);
    assertThat(cloudStorageCounts.getStorageBytesUsed()).isEqualTo(123456789L);

    List<ListClusterResponse> clusters = resources.getClusters();
    assertThat(clusters.size()).isEqualTo(1);
    ListClusterResponse cluster = clusters.get(0);
    assertThat(cluster.getClusterName()).isEqualTo("cluster");
    assertThat(cluster.getGoogleProject()).isEqualTo("google-project");
    assertThat(cluster.getStatus()).isEqualTo(ClusterStatus.STOPPED);
  }

  @Test
  public void getFederatedWorkspaceDetails_404sWhenNotFound() {
    ResponseEntity<AdminFederatedWorkspaceDetailsResponse> response =
        workspaceAdminController.getFederatedWorkspaceDetails(NONSENSE_NAMESPACE);
    assertThat(response.getStatusCodeValue()).isEqualTo(404);
  }

  private DbWorkspace createDbWorkspaceStub(Workspace workspace) {
    DbWorkspace dbWorkspace = new DbWorkspace();
    dbWorkspace.setWorkspaceId(Long.parseLong(workspace.getId()));
    dbWorkspace.setName(workspace.getName());
    dbWorkspace.setWorkspaceNamespace(workspace.getNamespace());
    dbWorkspace.setFirecloudName(workspace.getGoogleBucketName());
    ResearchPurpose researchPurpose = workspace.getResearchPurpose();
    dbWorkspace.setDiseaseFocusedResearch(researchPurpose.getDiseaseFocusedResearch());
    dbWorkspace.setDiseaseOfFocus(researchPurpose.getDiseaseOfFocus());
    dbWorkspace.setMethodsDevelopment(researchPurpose.getMethodsDevelopment());
    dbWorkspace.setControlSet(researchPurpose.getControlSet());
    dbWorkspace.setAncestry(researchPurpose.getAncestry());
    dbWorkspace.setCommercialPurpose(researchPurpose.getCommercialPurpose());
    dbWorkspace.setSocialBehavioral(researchPurpose.getSocialBehavioral());
    dbWorkspace.setPopulationHealth(researchPurpose.getPopulationHealth());
    dbWorkspace.setEducational(researchPurpose.getEducational());
    dbWorkspace.setDrugDevelopment(researchPurpose.getDrugDevelopment());
    dbWorkspace.setPopulation(researchPurpose.getPopulation());
    dbWorkspace.setPopulationDetails(
        researchPurpose.getPopulationDetails().stream()
            .map(DbStorageEnums::specificPopulationToStorage)
            .collect(Collectors.toSet()));
    dbWorkspace.setAdditionalNotes(researchPurpose.getAdditionalNotes());
    dbWorkspace.setReasonForAllOfUs(researchPurpose.getReasonForAllOfUs());
    dbWorkspace.setIntendedStudy(researchPurpose.getIntendedStudy());
    dbWorkspace.setAnticipatedFindings(researchPurpose.getAnticipatedFindings());
    return dbWorkspace;
  }
}
