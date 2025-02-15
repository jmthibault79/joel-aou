package org.pmiops.workbench.genomics;

import static com.google.common.truth.Truth.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.pmiops.workbench.genomics.GenomicExtractionService.EXTRACT_WORKFLOW_NAME;

import com.google.cloud.storage.Blob;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.pmiops.workbench.access.AccessTierServiceImpl;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.dataset.DataSetService;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.dao.DataSetDao;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.WgsExtractCromwellSubmissionDao;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.DbCdrVersion;
import org.pmiops.workbench.db.model.DbDataset;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWgsExtractCromwellSubmission;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.FailedPreconditionException;
import org.pmiops.workbench.exceptions.ForbiddenException;
import org.pmiops.workbench.firecloud.ApiException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.api.MethodConfigurationsApi;
import org.pmiops.workbench.firecloud.api.SubmissionsApi;
import org.pmiops.workbench.firecloud.model.FirecloudMethodConfiguration;
import org.pmiops.workbench.firecloud.model.FirecloudSubmission;
import org.pmiops.workbench.firecloud.model.FirecloudSubmissionResponse;
import org.pmiops.workbench.firecloud.model.FirecloudSubmissionStatus;
import org.pmiops.workbench.firecloud.model.FirecloudValidatedMethodConfiguration;
import org.pmiops.workbench.firecloud.model.FirecloudWorkflow;
import org.pmiops.workbench.firecloud.model.FirecloudWorkflowOutputs;
import org.pmiops.workbench.firecloud.model.FirecloudWorkflowOutputsResponse;
import org.pmiops.workbench.firecloud.model.FirecloudWorkflowStatus;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceDetails;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.google.CloudStorageClient;
import org.pmiops.workbench.google.StorageConfig;
import org.pmiops.workbench.jira.JiraService;
import org.pmiops.workbench.jira.model.CreatedIssue;
import org.pmiops.workbench.model.GenomicExtractionJob;
import org.pmiops.workbench.model.TerraJobStatus;
import org.pmiops.workbench.test.FakeClock;
import org.pmiops.workbench.utils.mappers.CommonMappers;
import org.pmiops.workbench.workspaces.WorkspaceAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Scope;
import org.springframework.test.annotation.DirtiesContext;

@DataJpaTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
public class GenomicExtractionServiceTest {

  private static final FakeClock CLOCK = new FakeClock(Instant.now(), ZoneId.systemDefault());
  private static final String FC_SUBMISSION_ID = "123";

  @Autowired GenomicExtractionService genomicExtractionService;
  @Autowired FireCloudService fireCloudService;
  @Autowired MethodConfigurationsApi methodConfigurationsApi;
  @Autowired SubmissionsApi submissionsApi;
  @Autowired WgsExtractCromwellSubmissionDao wgsExtractCromwellSubmissionDao;
  @Autowired UserDao userDao;
  @Autowired DataSetDao dataSetDao;
  @Autowired WorkspaceDao workspaceDao;
  @Autowired CdrVersionDao cdrVersionDao;
  @Autowired DataSetService mockDataSetService;
  @Autowired JiraService mockJiraService;

  private DbWorkspace targetWorkspace;

  private static CloudStorageClient cloudStorageClient;
  private static WorkbenchConfig workbenchConfig;
  private static DbUser currentUser;
  private static DbDataset dataset;

  @TestConfiguration
  @Import({
    AccessTierServiceImpl.class,
    GenomicExtractionService.class,
    GenomicExtractionMapperImpl.class,
    CommonMappers.class,
    WorkspaceAuthService.class
  })
  @MockBean({
    DataSetService.class,
    FireCloudService.class,
    JiraService.class,
    MethodConfigurationsApi.class,
    SubmissionsApi.class
  })
  static class Configuration {
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    @Qualifier(StorageConfig.GENOMIC_EXTRACTION_STORAGE_CLIENT)
    CloudStorageClient cloudStorageClient() {
      return cloudStorageClient;
    }

    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    DbUser user() {
      return currentUser;
    }

    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    WorkbenchConfig workbenchConfig() {
      return workbenchConfig;
    }

    @Bean
    Clock clock() {
      return CLOCK;
    }
  }

  @BeforeEach
  public void setUp() throws Exception {
    cloudStorageClient = mock(CloudStorageClient.class);
    Blob blob = mock(Blob.class);
    doReturn("bucket").when(blob).getBucket();
    doReturn("filename").when(blob).getName();
    doReturn(blob).when(cloudStorageClient).writeFile(any(), any(), any());
    workbenchConfig = new WorkbenchConfig();
    workbenchConfig.server = new WorkbenchConfig.ServerConfig();
    workbenchConfig.server.uiBaseUrl = "https://workbench.researchallofus.org";
    workbenchConfig.server.shortName = "test";
    workbenchConfig.firecloud = new WorkbenchConfig.FireCloudConfig();
    workbenchConfig.firecloud.terraUiBaseUrl = "https://app.terra.bio";
    workbenchConfig.wgsCohortExtraction = new WorkbenchConfig.WgsCohortExtractionConfig();
    workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceBucket = "terraBucket";
    workbenchConfig.wgsCohortExtraction.extractionMethodConfigurationName = "methodName";
    workbenchConfig.wgsCohortExtraction.extractionMethodConfigurationNamespace = "methodNamespace";
    workbenchConfig.wgsCohortExtraction.extractionMethodLogicalVersion = 3;
    workbenchConfig.wgsCohortExtraction.extractionMethodConfigurationVersion = 1;
    workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceNamespace =
        "operationalTerraWorkspaceNamespace";
    workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceName =
        "operationalTerraWorkspaceName";
    workbenchConfig.wgsCohortExtraction.minExtractionScatterTasks = 100;
    workbenchConfig.wgsCohortExtraction.extractionScatterTasksPerSample = 4;
    workbenchConfig.wgsCohortExtraction.extractionDestinationDataset = "extract-proj.extract-ds";

    FirecloudWorkspaceDetails fcWorkspace =
        new FirecloudWorkspaceDetails().bucketName("user-bucket");
    FirecloudWorkspaceResponse fcWorkspaceResponse =
        new FirecloudWorkspaceResponse().workspace(fcWorkspace);
    doReturn(Optional.of(fcWorkspaceResponse)).when(fireCloudService).getWorkspace(any());
    currentUser = createUser("a@fake-research-aou.org");

    FirecloudMethodConfiguration firecloudMethodConfiguration = new FirecloudMethodConfiguration();
    firecloudMethodConfiguration.setNamespace("methodNamespace");
    firecloudMethodConfiguration.setName("methodName");

    FirecloudValidatedMethodConfiguration validatedMethodConfiguration =
        new FirecloudValidatedMethodConfiguration();
    validatedMethodConfiguration.setMethodConfiguration(firecloudMethodConfiguration);
    doReturn(validatedMethodConfiguration)
        .when(methodConfigurationsApi)
        .createWorkspaceMethodConfig(any(), any(), any());

    DbCdrVersion cdrVersion = new DbCdrVersion();
    cdrVersion.setBigqueryProject("bigquery_project");
    cdrVersion.setWgsBigqueryDataset("wgs_dataset");
    cdrVersion = cdrVersionDao.save(cdrVersion);

    DbWorkspace workspace = new DbWorkspace();
    workspace.setWorkspaceNamespace("target-ws-namespace");
    workspace.setFirecloudName("target-ws-fc-name");
    workspace.setName("target-ws-name");
    workspace.setWorkspaceId(2);
    workspace.setCdrVersion(cdrVersion);
    targetWorkspace = workspaceDao.save(workspace);

    FirecloudSubmissionResponse submissionResponse = new FirecloudSubmissionResponse();
    submissionResponse.setSubmissionId(FC_SUBMISSION_ID);
    submissionResponse.setSubmissionDate(
        CommonMappers.offsetDateTimeUtc(new Timestamp(CLOCK.instant().toEpochMilli())));
    doReturn(submissionResponse).when(submissionsApi).createSubmission(any(), any(), any());

    doReturn(new FirecloudWorkspaceResponse().accessLevel("READER"))
        .when(fireCloudService)
        .getWorkspace(anyString(), anyString());

    doReturn(new CreatedIssue().key("RW-123"))
        .when(mockJiraService)
        .createIssue(any(), any(), any());

    dataset = createDataset();
  }

  public void mockGetFirecloudSubmission(FirecloudSubmission submission) throws ApiException {
    doReturn(submission)
        .when(submissionsApi)
        .getSubmission(
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceNamespace,
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceName,
            submission.getSubmissionId());
  }

  @Test
  public void getExtractionJobs() throws ApiException {
    OffsetDateTime submissionDate = OffsetDateTime.now();
    DbWgsExtractCromwellSubmission dbWgsExtractCromwellSubmission =
        createDbWgsExtractCromwellSubmission();
    dbWgsExtractCromwellSubmission.setUserCost(new BigDecimal("2.05"));
    wgsExtractCromwellSubmissionDao.save(dbWgsExtractCromwellSubmission);

    OffsetDateTime completionTimestamp = submissionDate.plusSeconds(127313);

    FirecloudSubmission submission =
        new FirecloudSubmission()
            .submissionId(dbWgsExtractCromwellSubmission.getSubmissionId())
            .status(FirecloudSubmissionStatus.DONE)
            .addWorkflowsItem(
                new FirecloudWorkflow()
                    .statusLastChangedDate(completionTimestamp)
                    .status(FirecloudWorkflowStatus.SUCCEEDED))
            .submissionDate(submissionDate);
    mockGetFirecloudSubmission(submission);
    mockWorkflowOutputVcfSize(submission, 12345.0);

    GenomicExtractionJob wgsCohortExtractionJob =
        genomicExtractionService
            .getGenomicExtractionJobs(
                targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName())
            .get(0);

    assertThat(wgsCohortExtractionJob.getCost()).isEqualTo(new BigDecimal("2.05"));
    assertThat(wgsCohortExtractionJob.getCompletionTime())
        .isEqualTo(completionTimestamp.toInstant().toEpochMilli());
    assertThat(wgsCohortExtractionJob.getDatasetName()).isEqualTo(dataset.getName());
    assertThat(wgsCohortExtractionJob.getStatus()).isEqualTo(TerraJobStatus.SUCCEEDED);
  }

  @Test
  public void getExtractionJobs_userHasReaderWorkspaceAccess() throws ApiException {
    final String submissionId = UUID.randomUUID().toString();
    DbWgsExtractCromwellSubmission dbWgsExtractCromwellSubmission =
        new DbWgsExtractCromwellSubmission();
    dbWgsExtractCromwellSubmission.setSubmissionId(submissionId);
    dbWgsExtractCromwellSubmission.setCreator(currentUser);
    dbWgsExtractCromwellSubmission.setWorkspace(targetWorkspace);
    wgsExtractCromwellSubmissionDao.save(dbWgsExtractCromwellSubmission);

    mockGetFirecloudSubmission(
        new FirecloudSubmission()
            .submissionId(dbWgsExtractCromwellSubmission.getSubmissionId())
            .status(FirecloudSubmissionStatus.DONE)
            .addWorkflowsItem(new FirecloudWorkflow().statusLastChangedDate(OffsetDateTime.now()))
            .submissionDate(OffsetDateTime.now()));

    doReturn(new FirecloudWorkspaceResponse().accessLevel("NO ACCESS"))
        .when(fireCloudService)
        .getWorkspace(targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName());

    assertThrows(
        ForbiddenException.class,
        () -> {
          genomicExtractionService.getGenomicExtractionJobs(
              targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName());
        });

    doReturn(new FirecloudWorkspaceResponse().accessLevel("READER"))
        .when(fireCloudService)
        .getWorkspace(targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName());
    genomicExtractionService.getGenomicExtractionJobs(
        targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName());
  }

  @Test
  public void getExtractionJobs_status() throws ApiException {
    Map<Long, TerraJobStatus> expectedStatuses = new HashMap<>();

    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.DONE, FirecloudWorkflowStatus.SUCCEEDED)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.SUCCEEDED);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.DONE, FirecloudWorkflowStatus.FAILED)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.FAILED);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.ABORTED, FirecloudWorkflowStatus.ABORTED)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.ABORTED);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.ABORTING, FirecloudWorkflowStatus.ABORTING)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.ABORTING);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.ACCEPTED, FirecloudWorkflowStatus.QUEUED)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.RUNNING);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.EVALUATING, FirecloudWorkflowStatus.RUNNING)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.RUNNING);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.SUBMITTED, FirecloudWorkflowStatus.SUBMITTED)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.RUNNING);
    expectedStatuses.put(
        createSubmissionAndMockMonitorCall(
                FirecloudSubmissionStatus.SUBMITTING, FirecloudWorkflowStatus.LAUNCHING)
            .getWgsExtractCromwellSubmissionId(),
        TerraJobStatus.RUNNING);

    genomicExtractionService
        .getGenomicExtractionJobs(
            targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName())
        .forEach(
            job -> {
              assertThat(job.getStatus())
                  .isEqualTo(expectedStatuses.get(job.getGenomicExtractionJobId()));
            });
  }

  @Test
  public void getExtractionJobs_saveSize() throws ApiException {
    Double expectedVcfSize = 54321.0;

    DbWgsExtractCromwellSubmission dbSubmission =
        createSubmissionAndMockMonitorCall(
            FirecloudSubmissionStatus.DONE, FirecloudWorkflowStatus.SUCCEEDED, expectedVcfSize);

    assertThat(dbSubmission.getVcfSizeMb()).isNull();

    genomicExtractionService.getGenomicExtractionJobs(
        targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName());

    assertThat(dbSubmission.getVcfSizeMb()).isEqualTo(expectedVcfSize.longValue());
  }

  @Test
  public void getExtractionJobs_reportJiraTicketOnFailure() throws Exception {
    workbenchConfig.wgsCohortExtraction.enableJiraTicketingOnFailure = true;
    DbWgsExtractCromwellSubmission dbSubmission =
        createSubmissionAndMockMonitorCall(
            FirecloudSubmissionStatus.DONE, FirecloudWorkflowStatus.FAILED);

    genomicExtractionService.getGenomicExtractionJobs(
        targetWorkspace.getWorkspaceNamespace(), targetWorkspace.getFirecloudName());

    verify(mockJiraService).createIssue(any(), any(), any());
  }

  private DbWgsExtractCromwellSubmission createDbWgsExtractCromwellSubmission() {
    DbWgsExtractCromwellSubmission dbWgsExtractCromwellSubmission =
        new DbWgsExtractCromwellSubmission();
    dbWgsExtractCromwellSubmission.setDataset(dataset);
    dbWgsExtractCromwellSubmission.setSubmissionId(UUID.randomUUID().toString());
    dbWgsExtractCromwellSubmission.setCreator(currentUser);
    dbWgsExtractCromwellSubmission.setWorkspace(targetWorkspace);
    dbWgsExtractCromwellSubmission.setTerraSubmissionDate(Timestamp.from(CLOCK.instant()));
    wgsExtractCromwellSubmissionDao.save(dbWgsExtractCromwellSubmission);

    return dbWgsExtractCromwellSubmission;
  }

  private DbWgsExtractCromwellSubmission createSubmissionAndMockMonitorCall(
      FirecloudSubmissionStatus submissionStatus,
      FirecloudWorkflowStatus workflowStatus,
      Double vcfSize)
      throws ApiException {
    DbWgsExtractCromwellSubmission dbWgsExtractCromwellSubmission =
        createDbWgsExtractCromwellSubmission();
    FirecloudSubmission firecloudSubmission =
        new FirecloudSubmission()
            .submissionId(dbWgsExtractCromwellSubmission.getSubmissionId())
            .addWorkflowsItem(
                new FirecloudWorkflow()
                    .workflowId(UUID.randomUUID().toString())
                    .statusLastChangedDate(OffsetDateTime.now())
                    .status(workflowStatus))
            .status(submissionStatus)
            .submissionDate(OffsetDateTime.now());

    doReturn(firecloudSubmission)
        .when(submissionsApi)
        .getSubmission(
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceNamespace,
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceName,
            dbWgsExtractCromwellSubmission.getSubmissionId());

    mockWorkflowOutputVcfSize(firecloudSubmission, vcfSize);

    return dbWgsExtractCromwellSubmission;
  }

  private void mockWorkflowOutputVcfSize(FirecloudSubmission submission, Double vcfSize)
      throws ApiException {
    doReturn(
            new FirecloudWorkflowOutputsResponse()
                .tasks(
                    ImmutableMap.of(
                        EXTRACT_WORKFLOW_NAME,
                        new FirecloudWorkflowOutputs()
                            .outputs(
                                ImmutableMap.of(
                                    EXTRACT_WORKFLOW_NAME + ".total_vcfs_size_mb", vcfSize)))))
        .when(submissionsApi)
        .getWorkflowOutputs(
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceNamespace,
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceName,
            submission.getSubmissionId(),
            submission.getWorkflows().get(0).getWorkflowId());
  }

  private DbWgsExtractCromwellSubmission createSubmissionAndMockMonitorCall(
      FirecloudSubmissionStatus submissionStatus, FirecloudWorkflowStatus workflowStatus)
      throws ApiException {
    return createSubmissionAndMockMonitorCall(submissionStatus, workflowStatus, 12345.0);
  }

  @Test
  public void submitExtractionJob() throws ApiException {
    when(mockDataSetService.getPersonIdsWithWholeGenome(any()))
        .thenReturn(ImmutableList.of("1", "2", "3"));
    genomicExtractionService.submitGenomicExtractionJob(targetWorkspace, dataset);

    verify(cloudStorageClient)
        .writeFile(
            eq(workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceBucket),
            matches("genomic-extractions\\/.*\\/person_ids.txt"),
            any());
    List<DbWgsExtractCromwellSubmission> dbSubmissions =
        ImmutableList.copyOf(wgsExtractCromwellSubmissionDao.findAll());
    assertThat(dbSubmissions.size()).isEqualTo(1);
    assertThat(dbSubmissions.get(0).getSubmissionId()).isEqualTo(FC_SUBMISSION_ID);
    assertThat(dbSubmissions.get(0).getSampleCount()).isEqualTo(3);
    assertThat(dbSubmissions.get(0).getTerraSubmissionDate())
        .isEqualTo(new Timestamp(CLOCK.instant().toEpochMilli()));
  }

  @Test
  public void submitExtractionJob_outputVcfsInCorrectBucket() throws ApiException {
    when(mockDataSetService.getPersonIdsWithWholeGenome(any())).thenReturn(ImmutableList.of("1"));
    genomicExtractionService.submitGenomicExtractionJob(targetWorkspace, dataset);

    ArgumentCaptor<FirecloudMethodConfiguration> argument =
        ArgumentCaptor.forClass(FirecloudMethodConfiguration.class);

    verify(methodConfigurationsApi).createWorkspaceMethodConfig(argument.capture(), any(), any());
    String actualOutputDir =
        argument.getValue().getInputs().get(EXTRACT_WORKFLOW_NAME + ".output_gcs_dir");

    assertThat(actualOutputDir)
        .matches("\"gs:\\/\\/user-bucket\\/genomic-extractions\\/.*\\/vcfs\\/\"");
  }

  @Test
  public void submitExtractionJob_many() throws ApiException {
    final List<String> largePersonIdList =
        LongStream.range(1, 376).boxed().map(id -> id.toString()).collect(Collectors.toList());
    when(mockDataSetService.getPersonIdsWithWholeGenome(any())).thenReturn(largePersonIdList);
    genomicExtractionService.submitGenomicExtractionJob(targetWorkspace, dataset);

    ArgumentCaptor<FirecloudMethodConfiguration> argument =
        ArgumentCaptor.forClass(FirecloudMethodConfiguration.class);

    verify(methodConfigurationsApi).createWorkspaceMethodConfig(argument.capture(), any(), any());
    String actualScatter =
        argument.getValue().getInputs().get(EXTRACT_WORKFLOW_NAME + ".scatter_count");
    assertThat(actualScatter).isEqualTo("1500");
  }

  @Test
  public void submitExtractionJob_noWgsData() throws ApiException {
    when(mockDataSetService.getPersonIdsWithWholeGenome(any())).thenReturn(ImmutableList.of());

    assertThrows(
        FailedPreconditionException.class,
        () -> genomicExtractionService.submitGenomicExtractionJob(targetWorkspace, dataset));
  }

  @Test
  public void submitExtractionJob_tooManySamples() throws ApiException {
    final List<String> largePersonIdList =
        LongStream.range(1, 6_000).boxed().map(id -> id.toString()).collect(Collectors.toList());
    when(mockDataSetService.getPersonIdsWithWholeGenome(any())).thenReturn(largePersonIdList);

    assertThrows(
        FailedPreconditionException.class,
        () -> genomicExtractionService.submitGenomicExtractionJob(targetWorkspace, dataset));
  }

  @Test
  public void abortGenomicExtractionJob() throws ApiException {
    DbWgsExtractCromwellSubmission dbWgsExtractCromwellSubmission =
        createSubmissionAndMockMonitorCall(
            FirecloudSubmissionStatus.EVALUATING, FirecloudWorkflowStatus.RUNNING);

    doNothing()
        .when(submissionsApi)
        .abortSubmission(
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceNamespace,
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceName,
            dbWgsExtractCromwellSubmission.getSubmissionId());

    genomicExtractionService.abortGenomicExtractionJob(
        targetWorkspace,
        String.valueOf(dbWgsExtractCromwellSubmission.getWgsExtractCromwellSubmissionId()));

    verify(submissionsApi, times(1))
        .abortSubmission(
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceNamespace,
            workbenchConfig.wgsCohortExtraction.operationalTerraWorkspaceName,
            dbWgsExtractCromwellSubmission.getSubmissionId());
  }

  private DbDataset createDataset() {
    DbDataset dataset = new DbDataset();
    dataset.setWorkspaceId(targetWorkspace.getWorkspaceId());
    dataset.setName("my dataset");
    return dataSetDao.save(dataset);
  }

  private DbUser createUser(String email) {
    DbUser user = new DbUser();
    user.setUsername(email);
    return userDao.save(user);
  }
}
