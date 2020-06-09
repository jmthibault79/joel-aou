package org.pmiops.workbench.api;

import static com.google.common.truth.Truth.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.cloud.Date;
import com.google.common.collect.ImmutableList;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.stream.Collectors;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.pmiops.workbench.actionaudit.auditors.ClusterAuditor;
import org.pmiops.workbench.actionaudit.auditors.UserServiceAuditor;
import org.pmiops.workbench.cohortreview.CohortReviewMapperImpl;
import org.pmiops.workbench.cohorts.CohortMapperImpl;
import org.pmiops.workbench.compliance.ComplianceService;
import org.pmiops.workbench.conceptset.ConceptSetMapperImpl;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.dataset.DataSetMapperImpl;
import org.pmiops.workbench.db.dao.AdminActionHistoryDao;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.UserRecentResourceService;
import org.pmiops.workbench.db.model.DbCdrVersion;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.ForbiddenException;
import org.pmiops.workbench.exceptions.NotFoundException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspace;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.google.DirectoryService;
import org.pmiops.workbench.institution.PublicInstitutionDetailsMapperImpl;
import org.pmiops.workbench.model.Cluster;
import org.pmiops.workbench.model.ClusterConfig;
import org.pmiops.workbench.model.ClusterLocalizeRequest;
import org.pmiops.workbench.model.ClusterLocalizeResponse;
import org.pmiops.workbench.model.ClusterStatus;
import org.pmiops.workbench.model.EmptyResponse;
import org.pmiops.workbench.model.ListClusterDeleteRequest;
import org.pmiops.workbench.model.UpdateClusterConfigRequest;
import org.pmiops.workbench.model.WorkspaceAccessLevel;
import org.pmiops.workbench.notebooks.LeonardoNotebooksClient;
import org.pmiops.workbench.notebooks.model.ListClusterResponse;
import org.pmiops.workbench.test.FakeClock;
import org.pmiops.workbench.test.FakeLongRandom;
import org.pmiops.workbench.testconfig.UserServiceTestConfiguration;
import org.pmiops.workbench.utils.mappers.CommonMappers;
import org.pmiops.workbench.utils.mappers.FirecloudMapperImpl;
import org.pmiops.workbench.utils.mappers.WorkspaceMapper;
import org.pmiops.workbench.utils.mappers.WorkspaceMapperImpl;
import org.pmiops.workbench.workspaces.WorkspaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Scope;
import org.springframework.http.ResponseEntity;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@RunWith(SpringRunner.class)
@DataJpaTest
@DirtiesContext(classMode = ClassMode.BEFORE_EACH_TEST_METHOD)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class ClusterControllerTest {

  private static final String BILLING_PROJECT_ID = "aou-rw-1234";
  private static final String BILLING_PROJECT_ID_2 = "aou-rw-5678";
  // a workspace's namespace is always its billing project ID
  private static final String WORKSPACE_NS = BILLING_PROJECT_ID;
  // Workspace ID is also known as firecloud_name. This identifier is generated by
  // Firecloud, based on the name of the workspace upon first creation. Firecloud
  // tends to remove whitespace and punctuation, lowercase everything, and concatenate
  // it together. Note that when a workspace name changes, the Firecloud name stays
  // the same.
  private static final String WORKSPACE_ID = "myfirstworkspace";
  private static final String WORKSPACE_NAME = "My First Workspace";
  private static final String LOGGED_IN_USER_EMAIL = "bob@gmail.com";
  private static final String OTHER_USER_EMAIL = "alice@gmail.com";
  private static final String BUCKET_NAME = "workspace-bucket";
  private static final Instant NOW = Instant.now();
  private static final FakeClock CLOCK = new FakeClock(NOW, ZoneId.systemDefault());
  private static final String API_HOST = "api.stable.fake-research-aou.org";
  private static final String API_BASE_URL = "https://" + API_HOST;
  private static final String BIGQUERY_DATASET = "dataset-name";
  private static final String EXTRA_CLUSTER_NAME = "all-of-us-extra";
  private static final String EXTRA_CLUSTER_NAME_DIFFERENT_PROJECT = "all-of-us-different-project";

  private static WorkbenchConfig config = new WorkbenchConfig();
  private static DbUser user = new DbUser();

  @TestConfiguration
  @Import({
    ClusterController.class,
    CohortMapperImpl.class,
    CohortReviewMapperImpl.class,
    ConceptSetMapperImpl.class,
    DataSetMapperImpl.class,
    FirecloudMapperImpl.class,
    WorkspaceMapperImpl.class,
    CommonMappers.class,
    PublicInstitutionDetailsMapperImpl.class,
    UserServiceTestConfiguration.class,
  })
  static class Configuration {

    @Bean
    @Scope("prototype")
    public WorkbenchConfig workbenchConfig() {
      return config;
    }

    @Bean
    Clock clock() {
      return CLOCK;
    }

    @Bean
    @Scope("prototype")
    DbUser user() {
      return user;
    }

    @Bean
    Random random() {
      return new FakeLongRandom(123);
    }
  }

  @Captor private ArgumentCaptor<Map<String, String>> mapCaptor;

  @MockBean AdminActionHistoryDao mockAdminActionHistoryDao;
  @MockBean ClusterAuditor mockClusterAuditor;
  @MockBean ComplianceService mockComplianceService;
  @MockBean DirectoryService mockDirectoryService;
  @MockBean FireCloudService mockFireCloudService;
  @MockBean LeonardoNotebooksClient mockLeoNotebooksClient;
  @MockBean UserRecentResourceService mockUserRecentResourceService;
  @MockBean UserServiceAuditor mockUserServiceAuditor;
  @MockBean WorkspaceService mockWorkspaceService;

  @Autowired UserDao userDao;
  @Autowired WorkspaceMapper workspaceMapper;
  @Autowired ClusterController clusterController;

  private DbCdrVersion cdrVersion;
  private org.pmiops.workbench.notebooks.model.Cluster testFcCluster;
  private org.pmiops.workbench.notebooks.model.Cluster testFcCluster2;
  private org.pmiops.workbench.notebooks.model.Cluster testFcClusterDifferentProject;
  private org.pmiops.workbench.notebooks.model.ListClusterResponse testFcClusterListResponse;
  private org.pmiops.workbench.notebooks.model.ListClusterResponse testFcClusterListResponse2;
  private org.pmiops.workbench.notebooks.model.ListClusterResponse
      testFcClusterListResponseDifferentProject;

  private Cluster testCluster;
  private DbWorkspace testWorkspace;

  @Before
  public void setUp() {
    config = WorkbenchConfig.createEmptyConfig();
    config.server.apiBaseUrl = API_BASE_URL;
    config.firecloud.registeredDomainName = "";
    config.firecloud.clusterDefaultMachineType = "n1-standard-4";
    config.firecloud.clusterDefaultDiskSizeGb = 50;
    config.access.enableComplianceTraining = true;

    user = new DbUser();
    user.setUsername(LOGGED_IN_USER_EMAIL);
    user.setUserId(123L);

    createUser(OTHER_USER_EMAIL);

    cdrVersion = new DbCdrVersion();
    cdrVersion.setName("1");
    // set the db name to be empty since test cases currently
    // run in the workbench schema only.
    cdrVersion.setCdrDbName("");
    cdrVersion.setBigqueryDataset(BIGQUERY_DATASET);

    String createdDate = Date.fromYearMonthDay(1988, 12, 26).toString();

    testFcCluster =
        new org.pmiops.workbench.notebooks.model.Cluster()
            .clusterName(getClusterName())
            .googleProject(BILLING_PROJECT_ID)
            .status(org.pmiops.workbench.notebooks.model.ClusterStatus.DELETING)
            .createdDate(createdDate);
    testFcClusterListResponse =
        new org.pmiops.workbench.notebooks.model.ListClusterResponse()
            .clusterName(getClusterName())
            .googleProject(BILLING_PROJECT_ID)
            .status(org.pmiops.workbench.notebooks.model.ClusterStatus.RUNNING)
            .createdDate(createdDate);
    testCluster =
        new Cluster()
            .clusterName(getClusterName())
            .clusterNamespace(BILLING_PROJECT_ID)
            .status(ClusterStatus.DELETING)
            .createdDate(createdDate);

    testFcCluster2 =
        new org.pmiops.workbench.notebooks.model.Cluster()
            .clusterName(EXTRA_CLUSTER_NAME)
            .googleProject(BILLING_PROJECT_ID)
            .status(org.pmiops.workbench.notebooks.model.ClusterStatus.RUNNING)
            .createdDate(createdDate);

    testFcClusterListResponse2 =
        new org.pmiops.workbench.notebooks.model.ListClusterResponse()
            .clusterName(EXTRA_CLUSTER_NAME)
            .googleProject(BILLING_PROJECT_ID)
            .status(org.pmiops.workbench.notebooks.model.ClusterStatus.RUNNING)
            .createdDate(createdDate);

    testFcClusterDifferentProject =
        new org.pmiops.workbench.notebooks.model.Cluster()
            .clusterName(EXTRA_CLUSTER_NAME_DIFFERENT_PROJECT)
            .googleProject(BILLING_PROJECT_ID_2)
            .status(org.pmiops.workbench.notebooks.model.ClusterStatus.RUNNING)
            .createdDate(createdDate);

    testFcClusterListResponseDifferentProject =
        new org.pmiops.workbench.notebooks.model.ListClusterResponse()
            .clusterName(EXTRA_CLUSTER_NAME_DIFFERENT_PROJECT)
            .googleProject(BILLING_PROJECT_ID_2)
            .status(org.pmiops.workbench.notebooks.model.ClusterStatus.RUNNING)
            .createdDate(createdDate);

    testWorkspace = new DbWorkspace();
    testWorkspace.setWorkspaceNamespace(WORKSPACE_NS);
    testWorkspace.setName(WORKSPACE_NAME);
    testWorkspace.setFirecloudName(WORKSPACE_ID);
    testWorkspace.setCdrVersion(cdrVersion);
    doReturn(testWorkspace).when(mockWorkspaceService).get(WORKSPACE_NS, WORKSPACE_ID);
    doReturn(Optional.of(testWorkspace)).when(mockWorkspaceService).getByNamespace(WORKSPACE_NS);
  }

  private FirecloudWorkspace createFcWorkspace(String ns, String name, String creator) {
    return new FirecloudWorkspace()
        .namespace(ns)
        .name(name)
        .createdBy(creator)
        .bucketName(BUCKET_NAME);
  }

  private void stubGetWorkspace(String workspaceNamespace, String firecloudName, String creator) {
    DbWorkspace w = new DbWorkspace();
    w.setWorkspaceNamespace(workspaceNamespace);
    w.setFirecloudName(firecloudName);
    w.setCdrVersion(cdrVersion);
    when(mockWorkspaceService.getRequired(workspaceNamespace, firecloudName)).thenReturn(w);
    when(mockWorkspaceService.getByNamespace(workspaceNamespace)).thenReturn(Optional.of(w));
    stubGetFcWorkspace(createFcWorkspace(workspaceNamespace, firecloudName, creator));
  }

  private void stubGetFcWorkspace(FirecloudWorkspace fcWorkspace) {
    FirecloudWorkspaceResponse fcResponse = new FirecloudWorkspaceResponse();
    fcResponse.setWorkspace(fcWorkspace);
    fcResponse.setAccessLevel(WorkspaceAccessLevel.OWNER.toString());
    when(mockFireCloudService.getWorkspace(fcWorkspace.getNamespace(), fcWorkspace.getName()))
        .thenReturn(fcResponse);
  }

  private JSONObject dataUriToJson(String dataUri) {
    String b64 = dataUri.substring(dataUri.indexOf(',') + 1);
    byte[] raw = Base64.getUrlDecoder().decode(b64);
    return new JSONObject(new String(raw));
  }

  private String getClusterName() {
    return "all-of-us-".concat(Long.toString(user.getUserId()));
  }

  @Test
  public void testGetCluster() {
    when(mockLeoNotebooksClient.getCluster(BILLING_PROJECT_ID, getClusterName()))
        .thenReturn(testFcCluster);

    assertThat(clusterController.getCluster(BILLING_PROJECT_ID).getBody()).isEqualTo(testCluster);
  }

  @Test
  public void testGetCluster_UnknownStatus() {
    when(mockLeoNotebooksClient.getCluster(BILLING_PROJECT_ID, getClusterName()))
        .thenReturn(testFcCluster.status(null));

    assertThat(clusterController.getCluster(BILLING_PROJECT_ID).getBody().getStatus())
        .isEqualTo(ClusterStatus.UNKNOWN);
  }

  @Test(expected = NotFoundException.class)
  public void testGetCluster_NullBillingProject() {
    clusterController.getCluster(null);
  }

  @Test
  public void testDeleteClustersInProject() {
    List<ListClusterResponse> listClusterResponseList = ImmutableList.of(testFcClusterListResponse);
    when(mockLeoNotebooksClient.listClustersByProjectAsService(BILLING_PROJECT_ID))
        .thenReturn(listClusterResponseList);

    clusterController.deleteClustersInProject(
        BILLING_PROJECT_ID,
        new ListClusterDeleteRequest()
            .clustersToDelete(ImmutableList.of(testFcCluster.getClusterName())));
    verify(mockLeoNotebooksClient)
        .deleteClusterAsService(BILLING_PROJECT_ID, testFcCluster.getClusterName());
    verify(mockClusterAuditor)
        .fireDeleteClustersInProject(
            BILLING_PROJECT_ID,
            listClusterResponseList.stream()
                .map(ListClusterResponse::getClusterName)
                .collect(Collectors.toList()));
  }

  @Test
  public void testDeleteClustersInProject_DeleteSome() {
    List<ListClusterResponse> listClusterResponseList =
        ImmutableList.of(testFcClusterListResponse, testFcClusterListResponse2);
    List<String> clustersToDelete = ImmutableList.of(testFcCluster.getClusterName());
    when(mockLeoNotebooksClient.listClustersByProjectAsService(BILLING_PROJECT_ID))
        .thenReturn(listClusterResponseList);

    clusterController.deleteClustersInProject(
        BILLING_PROJECT_ID, new ListClusterDeleteRequest().clustersToDelete(clustersToDelete));
    verify(mockLeoNotebooksClient, times(clustersToDelete.size()))
        .deleteClusterAsService(BILLING_PROJECT_ID, testFcCluster.getClusterName());
    verify(mockClusterAuditor, times(1))
        .fireDeleteClustersInProject(BILLING_PROJECT_ID, clustersToDelete);
  }

  @Test
  public void testDeleteClustersInProject_DeleteDoesNotAffectOtherProjects() {
    List<ListClusterResponse> listClusterResponseList =
        ImmutableList.of(testFcClusterListResponse, testFcClusterListResponse2);
    List<String> clustersToDelete =
        ImmutableList.of(testFcClusterDifferentProject.getClusterName());
    when(mockLeoNotebooksClient.listClustersByProjectAsService(BILLING_PROJECT_ID))
        .thenReturn(listClusterResponseList);

    clusterController.deleteClustersInProject(
        BILLING_PROJECT_ID, new ListClusterDeleteRequest().clustersToDelete(clustersToDelete));
    verify(mockLeoNotebooksClient, times(0))
        .deleteClusterAsService(BILLING_PROJECT_ID, testFcCluster.getClusterName());
    verify(mockClusterAuditor, times(0))
        .fireDeleteClustersInProject(BILLING_PROJECT_ID, clustersToDelete);
  }

  @Test
  public void testDeleteClustersInProject_NoClusters() {
    List<ListClusterResponse> listClusterResponseList = ImmutableList.of(testFcClusterListResponse);
    when(mockLeoNotebooksClient.listClustersByProjectAsService(BILLING_PROJECT_ID))
        .thenReturn(listClusterResponseList);

    clusterController.deleteClustersInProject(
        BILLING_PROJECT_ID, new ListClusterDeleteRequest().clustersToDelete(ImmutableList.of()));
    verify(mockLeoNotebooksClient, never())
        .deleteClusterAsService(BILLING_PROJECT_ID, testFcCluster.getClusterName());
    verify(mockClusterAuditor, never())
        .fireDeleteClustersInProject(
            BILLING_PROJECT_ID,
            listClusterResponseList.stream()
                .map(ListClusterResponse::getClusterName)
                .collect(Collectors.toList()));
  }

  @Test
  public void testDeleteClustersInProject_NullClustersList() {
    List<ListClusterResponse> listClusterResponseList = ImmutableList.of(testFcClusterListResponse);
    when(mockLeoNotebooksClient.listClustersByProjectAsService(BILLING_PROJECT_ID))
        .thenReturn(listClusterResponseList);

    clusterController.deleteClustersInProject(
        BILLING_PROJECT_ID, new ListClusterDeleteRequest().clustersToDelete(null));
    verify(mockLeoNotebooksClient)
        .deleteClusterAsService(BILLING_PROJECT_ID, testFcCluster.getClusterName());
    verify(mockClusterAuditor)
        .fireDeleteClustersInProject(
            BILLING_PROJECT_ID,
            listClusterResponseList.stream()
                .map(ListClusterResponse::getClusterName)
                .collect(Collectors.toList()));
  }

  @Test
  public void testCreateCluster() {
    when(mockLeoNotebooksClient.getCluster(BILLING_PROJECT_ID, getClusterName()))
        .thenThrow(new NotFoundException());
    when(mockLeoNotebooksClient.createCluster(
            eq(BILLING_PROJECT_ID), eq(getClusterName()), eq(WORKSPACE_ID)))
        .thenReturn(testFcCluster);
    stubGetWorkspace(WORKSPACE_NS, WORKSPACE_ID, "test");

    assertThat(clusterController.createCluster(BILLING_PROJECT_ID).getBody())
        .isEqualTo(testCluster);
  }

  @Test
  public void testDeleteCluster() {
    clusterController.deleteCluster(BILLING_PROJECT_ID);
    verify(mockLeoNotebooksClient).deleteCluster(BILLING_PROJECT_ID, getClusterName());
  }

  @Test
  public void testSetClusterConfig() {
    ResponseEntity<EmptyResponse> response =
        this.clusterController.updateClusterConfig(
            new UpdateClusterConfigRequest()
                .userEmail(OTHER_USER_EMAIL)
                .clusterConfig(
                    new ClusterConfig().machineType("n1-standard-16").masterDiskSize(100)));
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();

    DbUser updatedUser = userDao.findUserByUsername(OTHER_USER_EMAIL);
    assertThat(updatedUser.getClusterConfigDefault().machineType).isEqualTo("n1-standard-16");
    assertThat(updatedUser.getClusterConfigDefault().masterDiskSize).isEqualTo(100);
  }

  @Test
  public void testUpdateClusterConfigClear() {
    ResponseEntity<EmptyResponse> response =
        this.clusterController.updateClusterConfig(
            new UpdateClusterConfigRequest()
                .userEmail(OTHER_USER_EMAIL)
                .clusterConfig(
                    new ClusterConfig().machineType("n1-standard-16").masterDiskSize(100)));
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();

    response =
        this.clusterController.updateClusterConfig(
            new UpdateClusterConfigRequest().userEmail(OTHER_USER_EMAIL).clusterConfig(null));
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();

    DbUser updatedUser = userDao.findUserByUsername(OTHER_USER_EMAIL);
    assertThat(updatedUser.getClusterConfigDefault()).isNull();
  }

  @Test(expected = NotFoundException.class)
  public void testUpdateClusterConfigUserNotFound() {
    this.clusterController.updateClusterConfig(
        new UpdateClusterConfigRequest().userEmail("not-found@researchallofus.org"));
  }

  @Test
  public void testLocalize() {
    ClusterLocalizeRequest req =
        new ClusterLocalizeRequest()
            .notebookNames(ImmutableList.of("foo.ipynb"))
            .playgroundMode(false);
    stubGetWorkspace(WORKSPACE_NS, WORKSPACE_ID, LOGGED_IN_USER_EMAIL);
    ClusterLocalizeResponse resp = clusterController.localize(BILLING_PROJECT_ID, req).getBody();
    assertThat(resp.getClusterLocalDirectory()).isEqualTo("workspaces/myfirstworkspace");

    verify(mockLeoNotebooksClient)
        .localize(eq(BILLING_PROJECT_ID), eq(getClusterName()), mapCaptor.capture());
    Map<String, String> localizeMap = mapCaptor.getValue();
    assertThat(localizeMap.keySet())
        .containsExactly(
            "workspaces/myfirstworkspace/foo.ipynb",
            "workspaces_playground/myfirstworkspace/.all_of_us_config.json",
            "workspaces/myfirstworkspace/.all_of_us_config.json");
    assertThat(localizeMap)
        .containsEntry(
            "workspaces/myfirstworkspace/foo.ipynb", "gs://workspace-bucket/notebooks/foo.ipynb");
    JSONObject aouJson =
        dataUriToJson(localizeMap.get("workspaces/myfirstworkspace/.all_of_us_config.json"));
    assertThat(aouJson.getString("WORKSPACE_ID")).isEqualTo(WORKSPACE_ID);
    assertThat(aouJson.getString("BILLING_CLOUD_PROJECT")).isEqualTo(BILLING_PROJECT_ID);
    assertThat(aouJson.getString("API_HOST")).isEqualTo(API_HOST);
    verify(mockUserRecentResourceService, times(1))
        .updateNotebookEntry(anyLong(), anyLong(), anyString());
  }

  @Test
  public void testLocalize_playgroundMode() {
    ClusterLocalizeRequest req =
        new ClusterLocalizeRequest()
            .notebookNames(ImmutableList.of("foo.ipynb"))
            .playgroundMode(true);
    stubGetWorkspace(WORKSPACE_NS, WORKSPACE_ID, LOGGED_IN_USER_EMAIL);
    ClusterLocalizeResponse resp = clusterController.localize(BILLING_PROJECT_ID, req).getBody();
    assertThat(resp.getClusterLocalDirectory()).isEqualTo("workspaces_playground/myfirstworkspace");
    verify(mockLeoNotebooksClient)
        .localize(eq(BILLING_PROJECT_ID), eq(getClusterName()), mapCaptor.capture());
    Map<String, String> localizeMap = mapCaptor.getValue();
    assertThat(localizeMap.keySet())
        .containsExactly(
            "workspaces_playground/myfirstworkspace/foo.ipynb",
            "workspaces_playground/myfirstworkspace/.all_of_us_config.json",
            "workspaces/myfirstworkspace/.all_of_us_config.json");
    assertThat(localizeMap)
        .containsEntry(
            "workspaces_playground/myfirstworkspace/foo.ipynb",
            "gs://workspace-bucket/notebooks/foo.ipynb");
  }

  @Test
  public void testLocalize_differentNamespace() {
    ClusterLocalizeRequest req =
        new ClusterLocalizeRequest()
            .notebookNames(ImmutableList.of("foo.ipynb"))
            .playgroundMode(false);
    stubGetWorkspace(WORKSPACE_NS, WORKSPACE_ID, LOGGED_IN_USER_EMAIL);
    stubGetWorkspace("other-proj", "myotherworkspace", LOGGED_IN_USER_EMAIL);
    ClusterLocalizeResponse resp = clusterController.localize("other-proj", req).getBody();
    verify(mockLeoNotebooksClient)
        .localize(eq("other-proj"), eq(getClusterName()), mapCaptor.capture());

    Map<String, String> localizeMap = mapCaptor.getValue();
    assertThat(localizeMap.keySet())
        .containsExactly(
            "workspaces/myotherworkspace/foo.ipynb",
            "workspaces/myotherworkspace/.all_of_us_config.json",
            "workspaces_playground/myotherworkspace/.all_of_us_config.json");
    assertThat(localizeMap)
        .containsEntry(
            "workspaces/myotherworkspace/foo.ipynb", "gs://workspace-bucket/notebooks/foo.ipynb");
    assertThat(resp.getClusterLocalDirectory()).isEqualTo("workspaces/myotherworkspace");
    JSONObject aouJson =
        dataUriToJson(localizeMap.get("workspaces/myotherworkspace/.all_of_us_config.json"));
    assertThat(aouJson.getString("BILLING_CLOUD_PROJECT")).isEqualTo("other-proj");
  }

  @Test
  public void testLocalize_noNotebooks() {
    ClusterLocalizeRequest req = new ClusterLocalizeRequest();
    req.setPlaygroundMode(false);
    stubGetWorkspace(WORKSPACE_NS, WORKSPACE_ID, LOGGED_IN_USER_EMAIL);
    ClusterLocalizeResponse resp = clusterController.localize(BILLING_PROJECT_ID, req).getBody();
    verify(mockLeoNotebooksClient)
        .localize(eq(BILLING_PROJECT_ID), eq(getClusterName()), mapCaptor.capture());

    // Config files only.
    Map<String, String> localizeMap = mapCaptor.getValue();
    assertThat(localizeMap.keySet())
        .containsExactly(
            "workspaces_playground/myfirstworkspace/.all_of_us_config.json",
            "workspaces/myfirstworkspace/.all_of_us_config.json");
    assertThat(resp.getClusterLocalDirectory()).isEqualTo("workspaces/myfirstworkspace");
  }

  @Test
  public void GetCluster_validateActiveBilling() {
    doThrow(ForbiddenException.class)
        .when(mockWorkspaceService)
        .validateActiveBilling(WORKSPACE_NS, WORKSPACE_ID);

    assertThrows(ForbiddenException.class, () -> clusterController.getCluster(WORKSPACE_NS));
  }

  @Test
  public void getCluster_validateActiveBilling_checkAccessFirst() {
    doThrow(ForbiddenException.class)
        .when(mockWorkspaceService)
        .enforceWorkspaceAccessLevelAndRegisteredAuthDomain(
            WORKSPACE_NS, WORKSPACE_ID, WorkspaceAccessLevel.WRITER);

    assertThrows(ForbiddenException.class, () -> clusterController.getCluster(WORKSPACE_NS));
    verify(mockWorkspaceService, never()).validateActiveBilling(anyString(), anyString());
  }

  @Test
  public void localize_validateActiveBilling() {
    doThrow(ForbiddenException.class)
        .when(mockWorkspaceService)
        .validateActiveBilling(WORKSPACE_NS, WORKSPACE_ID);

    ClusterLocalizeRequest req = new ClusterLocalizeRequest();
    assertThrows(ForbiddenException.class, () -> clusterController.localize(WORKSPACE_NS, req));
  }

  @Test
  public void localize_validateActiveBilling_checkAccessFirst() {
    doThrow(ForbiddenException.class)
        .when(mockWorkspaceService)
        .enforceWorkspaceAccessLevelAndRegisteredAuthDomain(
            WORKSPACE_NS, WORKSPACE_ID, WorkspaceAccessLevel.WRITER);

    ClusterLocalizeRequest req = new ClusterLocalizeRequest();

    assertThrows(ForbiddenException.class, () -> clusterController.localize(WORKSPACE_NS, req));
    verify(mockWorkspaceService, never()).validateActiveBilling(anyString(), anyString());
  }

  private void createUser(String email) {
    DbUser user = new DbUser();
    user.setGivenName("first");
    user.setFamilyName("last");
    user.setUsername(email);
    userDao.save(user);
  }
}
