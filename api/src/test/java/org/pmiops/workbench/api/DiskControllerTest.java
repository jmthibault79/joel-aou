package org.pmiops.workbench.api;

import static com.google.common.truth.Truth.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.common.collect.ImmutableList;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Collections;
import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.pmiops.workbench.SpringTest;
import org.pmiops.workbench.access.AccessModuleService;
import org.pmiops.workbench.access.AccessTierServiceImpl;
import org.pmiops.workbench.actionaudit.auditors.LeonardoRuntimeAuditor;
import org.pmiops.workbench.actionaudit.auditors.UserServiceAuditor;
import org.pmiops.workbench.cohortreview.mapper.CohortReviewMapperImpl;
import org.pmiops.workbench.cohorts.CohortMapperImpl;
import org.pmiops.workbench.cohorts.CohortService;
import org.pmiops.workbench.compliance.ComplianceService;
import org.pmiops.workbench.conceptset.ConceptSetService;
import org.pmiops.workbench.conceptset.mapper.ConceptSetMapperImpl;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.dataset.mapper.DataSetMapperImpl;
import org.pmiops.workbench.db.dao.AdminActionHistoryDao;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.UserRecentResourceService;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.NotFoundException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.google.DirectoryService;
import org.pmiops.workbench.institution.PublicInstitutionDetailsMapperImpl;
import org.pmiops.workbench.leonardo.ApiException;
import org.pmiops.workbench.leonardo.LeonardoRetryHandler;
import org.pmiops.workbench.leonardo.api.DisksApi;
import org.pmiops.workbench.leonardo.model.LeonardoAuditInfo;
import org.pmiops.workbench.leonardo.model.LeonardoDiskStatus;
import org.pmiops.workbench.leonardo.model.LeonardoDiskType;
import org.pmiops.workbench.leonardo.model.LeonardoListPersistentDiskResponse;
import org.pmiops.workbench.leonardo.model.LeonardoUpdateDiskRequest;
import org.pmiops.workbench.mail.MailService;
import org.pmiops.workbench.model.Disk;
import org.pmiops.workbench.model.DiskStatus;
import org.pmiops.workbench.model.DiskType;
import org.pmiops.workbench.notebooks.LeonardoNotebooksClientImpl;
import org.pmiops.workbench.notebooks.NotebooksConfig;
import org.pmiops.workbench.notebooks.NotebooksRetryHandler;
import org.pmiops.workbench.notebooks.api.ProxyApi;
import org.pmiops.workbench.test.FakeClock;
import org.pmiops.workbench.test.FakeLongRandom;
import org.pmiops.workbench.testconfig.UserServiceTestConfiguration;
import org.pmiops.workbench.utils.mappers.CommonMappers;
import org.pmiops.workbench.utils.mappers.FirecloudMapperImpl;
import org.pmiops.workbench.utils.mappers.LeonardoMapper;
import org.pmiops.workbench.utils.mappers.LeonardoMapperImpl;
import org.pmiops.workbench.utils.mappers.WorkspaceMapperImpl;
import org.pmiops.workbench.workspaces.WorkspaceAuthService;
import org.pmiops.workbench.workspaces.WorkspaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Scope;
import org.springframework.retry.backoff.NoBackOffPolicy;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@DataJpaTest
@DirtiesContext(classMode = ClassMode.BEFORE_EACH_TEST_METHOD)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class DiskControllerTest extends SpringTest {
  private static final String WORKSPACE_NS = "workspace-ns";
  private static final String GOOGLE_PROJECT_ID = "aou-gcp-id";
  // Workspace ID is also known as firecloud_name. This identifier is generated by
  // Firecloud, based on the name of the workspace upon first creation. Firecloud
  // tends to remove whitespace and punctuation, lowercase everything, and concatenate
  // it together. Note that when a workspace name changes, the Firecloud name stays
  // the same.
  private static final String WORKSPACE_ID = "myfirstworkspace";
  private static final String WORKSPACE_NAME = "My First Workspace";
  private static final String LOGGED_IN_USER_EMAIL = "bob@gmail.com";
  private static final Instant NOW = Instant.now();
  private static final FakeClock CLOCK = new FakeClock(NOW, ZoneId.systemDefault());
  private static final String API_HOST = "api.stable.fake-research-aou.org";
  private static final String API_BASE_URL = "https://" + API_HOST;

  private static WorkbenchConfig config = new WorkbenchConfig();
  private static DbUser user = new DbUser();

  @TestConfiguration
  @Import({
    DiskController.class,
    CohortMapperImpl.class,
    CohortReviewMapperImpl.class,
    ConceptSetMapperImpl.class,
    DataSetMapperImpl.class,
    FirecloudMapperImpl.class,
    WorkspaceMapperImpl.class,
    CommonMappers.class,
    PublicInstitutionDetailsMapperImpl.class,
    UserServiceTestConfiguration.class,
    LeonardoMapperImpl.class,
    LeonardoNotebooksClientImpl.class,
    NotebooksRetryHandler.class,
    LeonardoRetryHandler.class,
    NoBackOffPolicy.class,
    AccessTierServiceImpl.class,
  })
  @MockBean({
    AccessModuleService.class,
    ConceptSetService.class,
    CohortService.class,
    MailService.class,
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

  @Captor private ArgumentCaptor<LeonardoUpdateDiskRequest> updateDiskRequestCaptor;

  @MockBean AdminActionHistoryDao mockAdminActionHistoryDao;
  @MockBean LeonardoRuntimeAuditor mockLeonardoRuntimeAuditor;
  @MockBean ComplianceService mockComplianceService;
  @MockBean DirectoryService mockDirectoryService;
  @MockBean FireCloudService mockFireCloudService;
  @MockBean UserRecentResourceService mockUserRecentResourceService;
  @MockBean UserServiceAuditor mockUserServiceAuditor;
  @MockBean WorkspaceService mockWorkspaceService;
  @MockBean WorkspaceAuthService mockWorkspaceAuthService;

  @Qualifier(NotebooksConfig.USER_DISKS_API)
  @MockBean
  DisksApi userDisksApi;

  @MockBean ProxyApi proxyApi;

  @MockBean WorkspaceDao workspaceDao;
  @Autowired UserDao userDao;
  @Autowired DiskController diskController;
  @Autowired LeonardoMapper leonardoMapper;

  @BeforeEach
  public void setUp() {
    config = WorkbenchConfig.createEmptyConfig();
    config.server.apiBaseUrl = API_BASE_URL;
    config.access.enableComplianceTraining = true;

    user = new DbUser();
    user.setUsername(LOGGED_IN_USER_EMAIL);
    user.setUserId(123L);

    DbWorkspace testWorkspace = new DbWorkspace();
    testWorkspace.setWorkspaceNamespace(WORKSPACE_NS);
    testWorkspace.setGoogleProject(GOOGLE_PROJECT_ID);
    testWorkspace.setName(WORKSPACE_NAME);
    testWorkspace.setFirecloudName(WORKSPACE_ID);
    doReturn(Optional.of(testWorkspace)).when(workspaceDao).getByNamespace(WORKSPACE_NS);
  }

  @Test
  public void testGetPD_MostRecentReady() throws ApiException {
    String readyPDName = user.generatePDName();
    LeonardoListPersistentDiskResponse readyPDResponse =
        createListPdResponse(readyPDName, LeonardoDiskStatus.READY, "2021-08-06T17:57:29.827954Z");

    String deletingPDName = user.generatePDName();
    LeonardoListPersistentDiskResponse deletingPDResponse =
        createListPdResponse(
            deletingPDName, LeonardoDiskStatus.DELETING, "2021-08-06T16:57:29.827954Z");

    Disk readyPD =
        new Disk().size(300).diskType(DiskType.STANDARD).name(readyPDName).status(DiskStatus.READY);

    when(userDisksApi.listDisksByProject(GOOGLE_PROJECT_ID, null, false))
        .thenReturn(ImmutableList.of(deletingPDResponse, readyPDResponse));
    assertThat(diskController.getDisk(WORKSPACE_NS).getBody()).isEqualTo(readyPD);
  }

  @Test
  public void testGetPD_MostRecentDeleting() throws ApiException {
    String readyPDName = user.generatePDName();
    LeonardoListPersistentDiskResponse readyPDResponse =
        createListPdResponse(readyPDName, LeonardoDiskStatus.READY, "2021-08-06T17:57:29.827954Z");

    String deletingPDName = user.generatePDName();
    LeonardoListPersistentDiskResponse deletingPDResponse =
        createListPdResponse(
            deletingPDName, LeonardoDiskStatus.DELETING, "2021-08-06T19:57:29.827954Z");

    Disk deletingPD =
        new Disk()
            .size(300)
            .diskType(DiskType.STANDARD)
            .name(deletingPDName)
            .status(DiskStatus.DELETING);

    when(userDisksApi.listDisksByProject(GOOGLE_PROJECT_ID, null, false))
        .thenReturn(ImmutableList.of(deletingPDResponse, readyPDResponse));
    assertThat(diskController.getDisk(WORKSPACE_NS).getBody()).isEqualTo(deletingPD);
  }

  @Test
  public void testGetDisk_noDisks() throws ApiException {
    when(userDisksApi.listDisksByProject(GOOGLE_PROJECT_ID, null, false))
        .thenReturn(Collections.emptyList());
    assertThrows(NotFoundException.class, () -> diskController.getDisk(WORKSPACE_NS));
  }

  @Test
  public void testGetDisk_UnknownStatus() throws ApiException {
    LeonardoListPersistentDiskResponse response =
        new LeonardoListPersistentDiskResponse()
            .name(user.generatePDName())
            .size(300)
            .diskType(LeonardoDiskType.STANDARD)
            .status(null)
            .auditInfo(new LeonardoAuditInfo().createdDate("2021-08-06T16:57:29.827954Z"))
            .googleProject(GOOGLE_PROJECT_ID);
    when(userDisksApi.listDisksByProject(GOOGLE_PROJECT_ID, null, false))
        .thenReturn(ImmutableList.of(response));
    assertThat(diskController.getDisk(WORKSPACE_NS).getBody().getStatus())
        .isEqualTo(DiskStatus.UNKNOWN);
  }

  @Test
  public void testGetDisk_NullBillingProject() {
    assertThrows(NotFoundException.class, () -> diskController.getDisk(null));
  }

  @Test
  public void testUpdateDisk() throws ApiException {
    int diskSize = 200;
    String diskName = user.generatePDName();
    diskController.updateDisk(WORKSPACE_NS, diskName, diskSize);
    verify(userDisksApi)
        .updateDisk(eq(GOOGLE_PROJECT_ID), eq(diskName), updateDiskRequestCaptor.capture());
    assertThat(diskSize).isEqualTo(updateDiskRequestCaptor.getValue().getSize());
  }

  @Test
  public void testDeleteDisk() throws ApiException {
    String diskName = user.generatePDName();
    diskController.deleteDisk(WORKSPACE_NS, diskName);
    verify(userDisksApi).deleteDisk(GOOGLE_PROJECT_ID, diskName);
  }

  private LeonardoListPersistentDiskResponse createListPdResponse(
      String pdName, LeonardoDiskStatus status, String date) {
    return new LeonardoListPersistentDiskResponse()
        .name(pdName)
        .size(300)
        .diskType(LeonardoDiskType.STANDARD)
        .status(status)
        .auditInfo(new LeonardoAuditInfo().createdDate(date))
        .googleProject(GOOGLE_PROJECT_ID);
  }
}
