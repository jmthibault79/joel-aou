package org.pmiops.workbench.api;

import static com.google.common.truth.Truth.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.pmiops.workbench.exfiltration.ExfiltrationConstants.EGRESS_OBJECT_LENGTHS_SERVICE_QUALIFIER;
import static org.pmiops.workbench.google.GoogleConfig.SERVICE_ACCOUNT_CLOUD_BILLING;

import com.google.api.services.cloudbilling.Cloudbilling;
import com.google.cloud.bigquery.Field;
import com.google.cloud.bigquery.FieldList;
import com.google.cloud.bigquery.FieldValue;
import com.google.cloud.bigquery.FieldValue.Attribute;
import com.google.cloud.bigquery.FieldValueList;
import com.google.cloud.bigquery.LegacySQLTypeName;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.QueryParameterValue;
import com.google.cloud.bigquery.StandardSQLTypeName;
import com.google.cloud.bigquery.TableResult;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.gson.Gson;
import java.io.FileReader;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.stream.Collectors;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.invocation.InvocationOnMock;
import org.pmiops.workbench.FakeClockConfiguration;
import org.pmiops.workbench.access.AccessModuleService;
import org.pmiops.workbench.access.AccessTierServiceImpl;
import org.pmiops.workbench.actionaudit.auditors.BillingProjectAuditor;
import org.pmiops.workbench.actionaudit.auditors.UserServiceAuditor;
import org.pmiops.workbench.actionaudit.auditors.WorkspaceAuditor;
import org.pmiops.workbench.actionaudit.bucket.BucketAuditQueryService;
import org.pmiops.workbench.billing.FreeTierBillingService;
import org.pmiops.workbench.cdr.CdrVersionService;
import org.pmiops.workbench.cdr.ConceptBigQueryService;
import org.pmiops.workbench.cdr.dao.DSDataDictionaryDao;
import org.pmiops.workbench.cdr.model.DbDSDataDictionary;
import org.pmiops.workbench.cloudtasks.TaskQueueService;
import org.pmiops.workbench.cohortbuilder.CohortBuilderService;
import org.pmiops.workbench.cohortbuilder.CohortQueryBuilder;
import org.pmiops.workbench.cohortbuilder.mapper.CohortBuilderMapper;
import org.pmiops.workbench.cohortreview.CohortReviewServiceImpl;
import org.pmiops.workbench.cohortreview.ReviewQueryBuilder;
import org.pmiops.workbench.cohortreview.mapper.CohortReviewMapperImpl;
import org.pmiops.workbench.cohortreview.mapper.ParticipantCohortAnnotationMapper;
import org.pmiops.workbench.cohortreview.mapper.ParticipantCohortStatusMapper;
import org.pmiops.workbench.cohorts.CohortCloningService;
import org.pmiops.workbench.cohorts.CohortFactoryImpl;
import org.pmiops.workbench.cohorts.CohortMapperImpl;
import org.pmiops.workbench.cohorts.CohortService;
import org.pmiops.workbench.compliance.ComplianceService;
import org.pmiops.workbench.conceptset.ConceptSetService;
import org.pmiops.workbench.conceptset.mapper.ConceptSetMapperImpl;
import org.pmiops.workbench.config.CdrBigQuerySchemaConfig;
import org.pmiops.workbench.config.CdrBigQuerySchemaConfigService;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.dataset.DataSetServiceImpl;
import org.pmiops.workbench.dataset.DatasetConfig;
import org.pmiops.workbench.dataset.mapper.DataSetMapperImpl;
import org.pmiops.workbench.db.dao.AccessTierDao;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.DbCdrVersion;
import org.pmiops.workbench.db.model.DbStorageEnums;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.exceptions.FailedPreconditionException;
import org.pmiops.workbench.exceptions.ForbiddenException;
import org.pmiops.workbench.exceptions.NotFoundException;
import org.pmiops.workbench.exfiltration.EgressRemediationService;
import org.pmiops.workbench.exfiltration.ObjectNameLengthServiceImpl;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACL;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceAccessEntry;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceDetails;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.genomics.GenomicExtractionService;
import org.pmiops.workbench.google.CloudBillingClient;
import org.pmiops.workbench.google.CloudStorageClient;
import org.pmiops.workbench.google.DirectoryService;
import org.pmiops.workbench.iam.IamService;
import org.pmiops.workbench.mail.MailService;
import org.pmiops.workbench.model.BillingStatus;
import org.pmiops.workbench.model.Cohort;
import org.pmiops.workbench.model.Concept;
import org.pmiops.workbench.model.ConceptSet;
import org.pmiops.workbench.model.ConceptSetConceptId;
import org.pmiops.workbench.model.CreateConceptSetRequest;
import org.pmiops.workbench.model.DataSet;
import org.pmiops.workbench.model.DataSetCodeResponse;
import org.pmiops.workbench.model.DataSetExportRequest;
import org.pmiops.workbench.model.DataSetPreviewValueList;
import org.pmiops.workbench.model.DataSetRequest;
import org.pmiops.workbench.model.Domain;
import org.pmiops.workbench.model.DomainValue;
import org.pmiops.workbench.model.DomainValuePair;
import org.pmiops.workbench.model.DomainWithDomainValues;
import org.pmiops.workbench.model.KernelTypeEnum;
import org.pmiops.workbench.model.MarkDataSetRequest;
import org.pmiops.workbench.model.PrePackagedConceptSetEnum;
import org.pmiops.workbench.model.ResearchPurpose;
import org.pmiops.workbench.model.ResourceType;
import org.pmiops.workbench.model.Workspace;
import org.pmiops.workbench.model.WorkspaceAccessLevel;
import org.pmiops.workbench.model.WorkspaceActiveStatus;
import org.pmiops.workbench.monitoring.LogsBasedMetricServiceFakeImpl;
import org.pmiops.workbench.notebooks.NotebooksService;
import org.pmiops.workbench.test.CohortDefinitions;
import org.pmiops.workbench.test.FakeClock;
import org.pmiops.workbench.test.FakeLongRandom;
import org.pmiops.workbench.test.TestBigQueryCdrSchemaConfig;
import org.pmiops.workbench.testconfig.UserServiceTestConfiguration;
import org.pmiops.workbench.utils.TestMockFactory;
import org.pmiops.workbench.utils.mappers.CommonMappers;
import org.pmiops.workbench.utils.mappers.FirecloudMapperImpl;
import org.pmiops.workbench.utils.mappers.UserMapperImpl;
import org.pmiops.workbench.utils.mappers.WorkspaceMapperImpl;
import org.pmiops.workbench.workspaces.WorkspaceAuthService;
import org.pmiops.workbench.workspaces.WorkspaceOperationMapper;
import org.pmiops.workbench.workspaces.WorkspaceServiceImpl;
import org.pmiops.workbench.workspaces.resources.UserRecentResourceService;
import org.pmiops.workbench.workspaces.resources.WorkspaceResourceMapperImpl;
import org.pmiops.workbench.workspaces.resources.WorkspaceResourcesServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Scope;
import org.springframework.http.HttpStatus;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

// TODO(jaycarlton): many of the tests here are testing DataSetServiceImpl more than
//   DataSetControllerImpl, so move those tests and setup stuff into DataSetServiceTest
//   and mock out DataSetService here.
@DataJpaTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class DataSetControllerTest {

  private static final String CONCEPT_SET_ONE_NAME = "concept set";
  private static final String WORKSPACE_BUCKET_NAME = "fc://bucket-hash";
  private static final String USER_EMAIL = "bob@gmail.com";
  private static final String TEST_CDR_PROJECT_ID = "all-of-us-ehr-dev";
  private static final String TEST_CDR_DATA_SET_ID = "synthetic_cdr20180606";
  private static final String TEST_CDR_TABLE = TEST_CDR_PROJECT_ID + "." + TEST_CDR_DATA_SET_ID;
  private static final String NAMED_PARAMETER_NAME = "p1_1";
  private static final QueryParameterValue NAMED_PARAMETER_VALUE =
      QueryParameterValue.string("concept_id");
  private static final String NAMED_PARAMETER_ARRAY_NAME = "p2_1";
  private static final QueryParameterValue NAMED_PARAMETER_ARRAY_VALUE =
      QueryParameterValue.array(new Integer[] {2, 5}, StandardSQLTypeName.INT64);

  private static final Instant NOW = Instant.now();
  private static final FakeClock CLOCK = new FakeClock(NOW, ZoneId.systemDefault());

  private static WorkbenchConfig workbenchConfig;
  private static DbUser currentUser;
  private Workspace workspace;
  private Workspace noAccessWorkspace;
  private Cohort cohort;
  private Cohort noAccessCohort;
  private ConceptSet conceptSet1;
  private ConceptSet noAccessConceptSet;
  private DataSet noAccessDataSet;
  private DbCdrVersion cdrVersion;

  @Autowired private AccessTierDao accessTierDao;
  @Autowired private CdrVersionDao cdrVersionDao;
  @Autowired private CohortsController cohortsController;
  @Autowired private ConceptSetsController conceptSetsController;
  @Autowired private DataSetController dataSetController;
  @Autowired private UserDao userDao;
  @Autowired private WorkspaceDao workspaceDao;
  @Autowired private WorkspacesController workspacesController;

  @MockBean private BigQueryService mockBigQueryService;
  @MockBean private CloudBillingClient cloudBillingClient;
  @MockBean private CdrBigQuerySchemaConfigService mockCdrBigQuerySchemaConfigService;
  @MockBean private CdrVersionService mockCdrVersionService;
  @MockBean private CohortQueryBuilder mockCohortQueryBuilder;
  @MockBean private DSDataDictionaryDao mockDSDataDictionaryDao;
  @MockBean private FireCloudService fireCloudService;
  @MockBean private GenomicExtractionService mockGenomicExtractionService;
  @MockBean private NotebooksService mockNotebooksService;
  @MockBean BucketAuditQueryService bucketAuditQueryService;

  @MockBean
  @Qualifier(EGRESS_OBJECT_LENGTHS_SERVICE_QUALIFIER)
  EgressRemediationService egressRemediationService;

  @Captor ArgumentCaptor<JSONObject> notebookContentsCaptor;

  @TestConfiguration
  @Import({
    FakeClockConfiguration.class,
    CohortFactoryImpl.class,
    CohortMapperImpl.class,
    CohortReviewMapperImpl.class,
    CohortReviewServiceImpl.class,
    CohortService.class,
    CohortsController.class,
    CommonMappers.class,
    ConceptSetMapperImpl.class,
    ConceptSetService.class,
    ConceptSetsController.class,
    DataSetController.class,
    DataSetMapperImpl.class,
    DataSetServiceImpl.class,
    FirecloudMapperImpl.class,
    LogsBasedMetricServiceFakeImpl.class,
    TestBigQueryCdrSchemaConfig.class,
    UserMapperImpl.class,
    UserServiceTestConfiguration.class,
    WorkspaceAuthService.class,
    WorkspaceMapperImpl.class,
    WorkspaceResourceMapperImpl.class,
    WorkspaceResourcesServiceImpl.class,
    WorkspaceServiceImpl.class,
    WorkspacesController.class,
    AccessTierServiceImpl.class,
    ObjectNameLengthServiceImpl.class,
    BucketAuditQueryService.class,
  })
  @MockBean({
    AccessModuleService.class,
    BigQueryService.class,
    BillingProjectAuditor.class,
    CloudBillingClient.class,
    CloudStorageClient.class,
    CohortBuilderMapper.class,
    CohortBuilderService.class,
    CohortCloningService.class,
    ComplianceService.class,
    ConceptBigQueryService.class,
    DirectoryService.class,
    FreeTierBillingService.class,
    IamService.class,
    MailService.class,
    ParticipantCohortAnnotationMapper.class,
    ParticipantCohortStatusMapper.class,
    ReviewQueryBuilder.class,
    TaskQueueService.class,
    UserRecentResourceService.class,
    UserServiceAuditor.class,
    WorkspaceAuditor.class,
    WorkspaceOperationMapper.class,
  })
  static class Configuration {
    @Bean(SERVICE_ACCOUNT_CLOUD_BILLING)
    Cloudbilling serviceAccountCloudbilling() {
      return TestMockFactory.createMockedCloudbilling();
    }

    @Bean
    Clock clock() {
      return CLOCK;
    }

    @Bean
    Random random() {
      return new FakeLongRandom(123);
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
    @Qualifier(DatasetConfig.DATASET_PREFIX_CODE)
    String prefixCode() {
      return "00000000";
    }
  }

  @BeforeEach
  public void setUp() throws Exception {
    TestMockFactory.stubCreateFcWorkspace(fireCloudService);
    TestMockFactory.stubCreateBillingProject(fireCloudService);
    TestMockFactory.stubPollCloudBillingLinked(cloudBillingClient, "billing-account");

    Gson gson = new Gson();
    CdrBigQuerySchemaConfig cdrBigQuerySchemaConfig =
        gson.fromJson(new FileReader("config/cdm/cdm_5_2.json"), CdrBigQuerySchemaConfig.class);

    doReturn(cdrBigQuerySchemaConfig).when(mockCdrBigQuerySchemaConfigService).getConfig();

    workbenchConfig = WorkbenchConfig.createEmptyConfig();
    workbenchConfig.billing.accountId = "free-tier";
    workbenchConfig.featureFlags.enableGenomicExtraction = true;

    DbUser user = new DbUser();
    user.setUsername(USER_EMAIL);
    user.setUserId(123L);
    user.setDisabled(false);
    user = userDao.save(user);
    currentUser = user;

    cdrVersion = TestMockFactory.createDefaultCdrVersion(cdrVersionDao, accessTierDao);
    cdrVersion = cdrVersionDao.save(cdrVersion);

    workspace =
        new Workspace()
            .name("name")
            .researchPurpose(new ResearchPurpose())
            .cdrVersionId(String.valueOf(cdrVersion.getCdrVersionId()))
            .billingAccountName("billing-account");

    workspace = workspacesController.createWorkspace(workspace).getBody();
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.OWNER);

    noAccessWorkspace =
        new Workspace()
            .name("other")
            .researchPurpose(new ResearchPurpose())
            .cdrVersionId(String.valueOf(cdrVersion.getCdrVersionId()))
            .billingAccountName("billing-account");

    noAccessWorkspace = workspacesController.createWorkspace(noAccessWorkspace).getBody();
    // Allow access initially for setup, update the mocks after initialization to remove access.
    // see end of inotialization block
    stubWorkspaceAccessLevel(noAccessWorkspace, WorkspaceAccessLevel.OWNER);

    noAccessCohort =
        cohortsController
            .createCohort(
                noAccessWorkspace.getNamespace(),
                noAccessWorkspace.getName(),
                new Cohort()
                    .name("noAccessCohort")
                    .criteria(new Gson().toJson(CohortDefinitions.allGenders())))
            .getBody();

    cohort =
        cohortsController
            .createCohort(
                workspace.getNamespace(),
                workspace.getName(),
                new Cohort().name("cohort1").criteria(new Gson().toJson(CohortDefinitions.males())))
            .getBody();

    List<Concept> conceptList = new ArrayList<>();

    conceptList.add(
        new Concept()
            .conceptId(123L)
            .conceptName("a concept")
            .standardConcept(true)
            .conceptCode("conceptA")
            .conceptClassId("classId")
            .vocabularyId("V1")
            .domainId("Condition")
            .countValue(123L)
            .prevalence(0.2F)
            .conceptSynonyms(Collections.emptyList()));

    ConceptSet conceptSet = new ConceptSet().name(CONCEPT_SET_ONE_NAME).domain(Domain.CONDITION);

    List<ConceptSetConceptId> conceptSetConceptIds =
        conceptList.stream()
            .map(
                c -> {
                  ConceptSetConceptId conceptSetConceptId = new ConceptSetConceptId();
                  conceptSetConceptId.setConceptId(c.getConceptId());
                  conceptSetConceptId.setStandard(true);
                  return conceptSetConceptId;
                })
            .collect(Collectors.toList());

    noAccessConceptSet =
        conceptSetsController
            .createConceptSet(
                noAccessWorkspace.getNamespace(),
                noAccessWorkspace.getName(),
                new CreateConceptSetRequest()
                    .conceptSet(conceptSet)
                    .addedConceptSetConceptIds(conceptSetConceptIds))
            .getBody();

    conceptSet1 =
        conceptSetsController
            .createConceptSet(
                workspace.getNamespace(),
                workspace.getName(),
                new CreateConceptSetRequest()
                    .conceptSet(conceptSet)
                    .addedConceptSetConceptIds(conceptSetConceptIds))
            .getBody();

    conceptList = new ArrayList<>();

    conceptList.add(
        new Concept()
            .conceptId(456L)
            .conceptName("a concept of type survey")
            .standardConcept(true)
            .conceptCode("conceptA")
            .conceptClassId("classId")
            .vocabularyId("V1")
            .domainId("Observation")
            .countValue(123L)
            .prevalence(0.2F)
            .conceptSynonyms(new ArrayList<>()));

    noAccessDataSet =
        dataSetController
            .createDataSet(
                noAccessWorkspace.getNamespace(),
                noAccessWorkspace.getName(),
                buildEmptyDataSetRequest()
                    .name("no access ds")
                    .addCohortIdsItem(noAccessCohort.getId())
                    .addConceptSetIdsItem(noAccessConceptSet.getId())
                    .domainValuePairs(mockDomainValuePair()))
            .getBody();

    when(mockCohortQueryBuilder.buildParticipantIdQuery(any()))
        .thenReturn(
            QueryJobConfiguration.newBuilder(
                    "SELECT * FROM person_id from `${projectId}.${dataSetId}.person` person WHERE @"
                        + NAMED_PARAMETER_NAME
                        + " IN unnest(@"
                        + NAMED_PARAMETER_ARRAY_NAME
                        + ")")
                .addNamedParameter(NAMED_PARAMETER_NAME, NAMED_PARAMETER_VALUE)
                .addNamedParameter(NAMED_PARAMETER_ARRAY_NAME, NAMED_PARAMETER_ARRAY_VALUE)
                .build());

    // This is not great, but due to the interaction of mocks and bigquery, it is
    // exceptionally hard to fix it so that it calls the real filterBitQueryConfig
    // but _does not_ call the real methods in the rest of the bigQueryService.
    // I tried .thenCallRealMethod() which ended up giving a null pointer from the mock,
    // as opposed to calling through.
    when(mockBigQueryService.filterBigQueryConfig(any()))
        .thenAnswer(
            (InvocationOnMock invocation) -> {
              Object[] args = invocation.getArguments();
              QueryJobConfiguration queryJobConfiguration = (QueryJobConfiguration) args[0];

              String returnSql =
                  queryJobConfiguration.getQuery().replace("${projectId}", TEST_CDR_PROJECT_ID);
              returnSql = returnSql.replace("${dataSetId}", TEST_CDR_DATA_SET_ID);
              return queryJobConfiguration.toBuilder().setQuery(returnSql).build();
            });
    // Allow access initially for setup, update the mocks after initialization to remove access.
    stubWorkspaceAccessLevel(noAccessWorkspace, WorkspaceAccessLevel.NO_ACCESS);
  }

  private DataSetRequest buildEmptyDataSetRequest() {
    return new DataSetRequest()
        .conceptSetIds(new ArrayList<>())
        .cohortIds(new ArrayList<>())
        .domainValuePairs(new ArrayList<>())
        .name("blah")
        .prePackagedConceptSet(ImmutableList.of(PrePackagedConceptSetEnum.NONE));
  }

  private void stubWorkspaceAccessLevel(
      Workspace workspace, WorkspaceAccessLevel workspaceAccessLevel) {
    stubGetWorkspace(workspace.getNamespace(), workspace.getName(), workspaceAccessLevel);
    stubGetWorkspaceAcl(workspace.getNamespace(), workspace.getName(), workspaceAccessLevel);
  }

  private void stubGetWorkspace(String ns, String name, WorkspaceAccessLevel workspaceAccessLevel) {
    FirecloudWorkspaceDetails fcWorkspace = new FirecloudWorkspaceDetails();
    fcWorkspace.setNamespace(ns);
    fcWorkspace.setName(name);
    fcWorkspace.setCreatedBy(DataSetControllerTest.USER_EMAIL);
    fcWorkspace.setBucketName(WORKSPACE_BUCKET_NAME);
    FirecloudWorkspaceResponse fcResponse = new FirecloudWorkspaceResponse();
    fcResponse.setWorkspace(fcWorkspace);
    fcResponse.setAccessLevel(workspaceAccessLevel.toString());
    when(fireCloudService.getWorkspace(ns, name)).thenReturn(fcResponse);
  }

  private void stubGetWorkspaceAcl(String ns, String name, WorkspaceAccessLevel accessLevel) {
    FirecloudWorkspaceACL workspaceAccessLevelResponse = new FirecloudWorkspaceACL();
    FirecloudWorkspaceAccessEntry accessLevelEntry =
        new FirecloudWorkspaceAccessEntry().accessLevel(accessLevel.toString());
    Map<String, FirecloudWorkspaceAccessEntry> userEmailToAccessEntry =
        ImmutableMap.of(DataSetControllerTest.USER_EMAIL, accessLevelEntry);
    workspaceAccessLevelResponse.setAcl(userEmailToAccessEntry);
    when(fireCloudService.getWorkspaceAclAsService(ns, name))
        .thenReturn(workspaceAccessLevelResponse);
  }

  private List<DomainValuePair> mockDomainValuePair() {
    List<DomainValuePair> domainValues = new ArrayList<>();
    domainValues.add(new DomainValuePair().domain(Domain.CONDITION).value("PERSON_ID"));
    return domainValues;
  }

  private void mockLinkingTableQuery() {
    final TableResult tableResultMock = mock(TableResult.class);

    final FieldList schema =
        FieldList.of(ImmutableList.of(Field.of("PERSON_ID", LegacySQLTypeName.INTEGER)));

    ArrayList<FieldValue> rows = new ArrayList<>();
    rows.add(FieldValue.of(Attribute.PRIMITIVE, "1"));
    doReturn(ImmutableList.of(FieldValueList.of(rows, schema))).when(tableResultMock).getValues();

    doReturn(tableResultMock).when(mockBigQueryService).executeQuery(any());
  }

  @Test
  public void testAddFieldValuesFromBigQueryToPreviewListWorksWithNullValues() {
    DataSetPreviewValueList dataSetPreviewValueList = new DataSetPreviewValueList();
    List<DataSetPreviewValueList> valuePreviewList = ImmutableList.of(dataSetPreviewValueList);
    List<FieldValue> fieldValueListRows =
        ImmutableList.of(FieldValue.of(FieldValue.Attribute.PRIMITIVE, null));
    FieldValueList fieldValueList = FieldValueList.of(fieldValueListRows);
    dataSetController.addFieldValuesFromBigQueryToPreviewList(valuePreviewList, fieldValueList);
    assertThat(valuePreviewList.get(0).getQueryValue().get(0))
        .isEqualTo(DataSetController.EMPTY_CELL_MARKER);
  }

  @Test
  public void testGetQueryFailsWithNoCohort() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet =
        dataSet
            .addConceptSetIdsItem(conceptSet1.getId())
            .domainValuePairs(ImmutableList.of(new DomainValuePair().domain(Domain.CONDITION)));

    DataSetRequest finalDataSet = dataSet;
    assertThrows(
        BadRequestException.class,
        () ->
            dataSetController.previewExportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .kernelType(KernelTypeEnum.PYTHON)
                    .dataSetRequest(finalDataSet)));
  }

  @Test
  public void testGetQueryFailsWithNoConceptSet() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet =
        dataSet
            .addCohortIdsItem(cohort.getId())
            .domainValuePairs(ImmutableList.of(new DomainValuePair().domain(Domain.CONDITION)));

    DataSetRequest finalDataSet = dataSet;
    assertThrows(
        BadRequestException.class,
        () ->
            dataSetController.previewExportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .kernelType(KernelTypeEnum.PYTHON)
                    .dataSetRequest(finalDataSet)));
  }

  @Test
  public void testGetQueryDropsQueriesWithNoValue() {
    final DataSetRequest dataSet =
        buildEmptyDataSetRequest()
            .dataSetId(1L)
            .addCohortIdsItem(cohort.getId())
            .addConceptSetIdsItem(conceptSet1.getId());

    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.previewExportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .kernelType(KernelTypeEnum.PYTHON)
                    .dataSetRequest(dataSet)));
  }

  @Test
  public void createDataSetMissingArguments() {
    DataSetRequest dataSet = buildEmptyDataSetRequest().name(null);

    List<Long> cohortIds = new ArrayList<>();
    cohortIds.add(1L);

    List<Long> conceptIds = new ArrayList<>();
    conceptIds.add(1L);

    List<DomainValuePair> valuePairList = new ArrayList<>();
    DomainValuePair domainValue = new DomainValuePair();
    domainValue.setDomain(Domain.DRUG);
    domainValue.setValue("DRUGS_VALUE");

    valuePairList.add(domainValue);

    dataSet.setDomainValuePairs(valuePairList);
    dataSet.setConceptSetIds(conceptIds);
    dataSet.setCohortIds(cohortIds);

    assertThrows(
        BadRequestException.class,
        () ->
            dataSetController.createDataSet(workspace.getNamespace(), workspace.getName(), dataSet),
        "Missing name");

    dataSet.setName("dataSet");
    dataSet.setCohortIds(null);

    assertThrows(
        BadRequestException.class,
        () ->
            dataSetController.createDataSet(workspace.getNamespace(), workspace.getName(), dataSet),
        "Missing cohort ids");

    dataSet.setCohortIds(cohortIds);
    dataSet.setConceptSetIds(null);

    assertThrows(
        BadRequestException.class,
        () ->
            dataSetController.createDataSet(workspace.getNamespace(), workspace.getName(), dataSet),
        "Missing concept set ids");

    dataSet.setConceptSetIds(conceptIds);
    dataSet.setDomainValuePairs(null);

    assertThrows(
        BadRequestException.class,
        () ->
            dataSetController.createDataSet(workspace.getNamespace(), workspace.getName(), dataSet),
        "Missing values");
  }

  @Test
  public void exportToNewNotebook() {
    DataSetExportRequest request = setUpValidDataSetExportRequest();

    dataSetController
        .exportToNotebook(workspace.getNamespace(), workspace.getName(), request)
        .getBody();
    verify(mockNotebooksService, never()).getNotebookContents(any(), any());
    // I tried to have this verify against the actual expected contents of the json object, but
    // java equivalence didn't handle it well.
    verify(mockNotebooksService, times(1))
        .saveNotebook(
            eq(WORKSPACE_BUCKET_NAME), eq(request.getNotebookName()), any(JSONObject.class));
  }

  @Test
  public void exportToNotebook_noAccess() {
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.exportToNotebook(
                    noAccessWorkspace.getNamespace(),
                    noAccessWorkspace.getName(),
                    new DataSetExportRequest()
                        .dataSetRequest(new DataSetRequest().includesAllParticipants(true))));

    assertForbiddenException(exception);
  }

  @Test
  public void exportToNotebook_noAccessDataSet() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.exportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .dataSetRequest(new DataSetRequest().dataSetId(noAccessDataSet.getId()))));
  }

  @Test
  public void exportToNotebook_requiresActiveBilling() {
    DbWorkspace dbWorkspace =
        workspaceDao.findByWorkspaceNamespaceAndFirecloudNameAndActiveStatus(
            workspace.getNamespace(),
            workspace.getName(),
            DbStorageEnums.workspaceActiveStatusToStorage(WorkspaceActiveStatus.ACTIVE));
    dbWorkspace.setBillingStatus(BillingStatus.INACTIVE);
    workspaceDao.save(dbWorkspace);

    DataSetExportRequest request = new DataSetExportRequest();

    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.exportToNotebook(
                    workspace.getNamespace(), workspace.getName(), request));

    assertThat(exception)
        .hasMessageThat()
        .containsMatch("Workspace.*is in an inactive billing state");
  }

  @Test
  public void exportToNotebook_cohortInvalid() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.exportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .dataSetRequest(
                        new DataSetRequest()
                            .conceptSetIds(ImmutableList.of(conceptSet1.getId()))
                            .cohortIds(ImmutableList.of(cohort.getId(), noAccessCohort.getId())))));
  }

  @Test
  public void exportToNotebook_conceptSetInvalid() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.exportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .dataSetRequest(
                        new DataSetRequest()
                            .conceptSetIds(
                                ImmutableList.of(
                                    conceptSet1.getId(), noAccessConceptSet.getId())))));
  }

  @Test
  public void generateCode_noAccess() {
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.previewExportToNotebook(
                    noAccessWorkspace.getNamespace(),
                    noAccessWorkspace.getName(),
                    new DataSetExportRequest()
                        .kernelType(KernelTypeEnum.PYTHON)
                        .dataSetRequest(new DataSetRequest().includesAllParticipants(true))));

    assertForbiddenException(exception);
  }

  @Test
  public void generateCode_noAccessDataSet() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.previewExportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .kernelType(KernelTypeEnum.PYTHON)
                    .dataSetRequest(new DataSetRequest().dataSetId(noAccessDataSet.getId()))));
  }

  @Test
  public void generateCode_cohortInvalid() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.previewExportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .kernelType(KernelTypeEnum.PYTHON)
                    .dataSetRequest(
                        new DataSetRequest()
                            .conceptSetIds(ImmutableList.of(conceptSet1.getId()))
                            .cohortIds(ImmutableList.of(cohort.getId(), noAccessCohort.getId())))));
  }

  @Test
  public void generateCode_conceptSetInvalid() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.previewExportToNotebook(
                workspace.getNamespace(),
                workspace.getName(),
                new DataSetExportRequest()
                    .kernelType(KernelTypeEnum.PYTHON)
                    .dataSetRequest(
                        new DataSetRequest()
                            .conceptSetIds(
                                ImmutableList.of(
                                    conceptSet1.getId(), noAccessConceptSet.getId())))));
  }

  @Test
  public void generateCode_pyhton() {
    mockLinkingTableQuery();
    DataSetRequest dataSetRequest = buildValidDataSetRequest();
    DataSetCodeResponse dataSetCodeResponse =
        dataSetController
            .generateCode(
                workspace.getNamespace(),
                workspace.getId(),
                KernelTypeEnum.PYTHON.toString(),
                dataSetRequest)
            .getBody();

    assertThat(dataSetCodeResponse.getCode())
        .containsMatch("import pandas[\\S|\\s]*pandas\\.read_gbq");
  }

  @Test
  public void generateCode_R() {
    mockLinkingTableQuery();
    DataSetRequest dataSetRequest = buildValidDataSetRequest();
    DataSetCodeResponse dataSetCodeResponse =
        dataSetController
            .generateCode(
                workspace.getNamespace(),
                workspace.getId(),
                KernelTypeEnum.R.toString(),
                dataSetRequest)
            .getBody();

    assertThat(dataSetCodeResponse.getCode())
        .containsMatch("library[\\S|\\s]*read_bq_export_from_workspace_bucket");
  }

  @Test
  public void exportToExistingNotebook() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(cohort.getId());
    dataSet = dataSet.addConceptSetIdsItem(conceptSet1.getId());
    List<DomainValuePair> domainValuePairs = mockDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery();

    String notebookName = "Hello World";

    when(mockNotebooksService.getNotebookContents(WORKSPACE_BUCKET_NAME, notebookName))
        .thenReturn(
            new JSONObject()
                .put("cells", new JSONArray())
                .put("metadata", new JSONObject())
                .put("nbformat", 4)
                .put("nbformat_minor", 2));

    when(mockNotebooksService.getNotebookKernel(any())).thenReturn(KernelTypeEnum.PYTHON);

    DataSetExportRequest request =
        new DataSetExportRequest()
            .dataSetRequest(dataSet)
            .newNotebook(false)
            .notebookName(notebookName);

    dataSetController
        .exportToNotebook(workspace.getNamespace(), workspace.getName(), request)
        .getBody();
    verify(mockNotebooksService, times(1)).getNotebookContents(WORKSPACE_BUCKET_NAME, notebookName);
    // I tried to have this verify against the actual expected contents of the json object, but
    // java equivalence didn't handle it well.
    verify(mockNotebooksService, times(1))
        .saveNotebook(eq(WORKSPACE_BUCKET_NAME), eq(notebookName), any(JSONObject.class));
  }

  @Test
  public void testGetValuesFromDomain() {
    when(mockBigQueryService.getTableFieldsFromDomain(Domain.MEASUREMENT))
        .thenReturn(
            FieldList.of(
                Field.of("FIELD_ONE", LegacySQLTypeName.STRING),
                Field.of("FIELD_TWO", LegacySQLTypeName.STRING)));
    List<DomainWithDomainValues> domainWithDomainValues =
        Objects.requireNonNull(
                dataSetController
                    .getValuesFromDomain(
                        workspace.getNamespace(),
                        workspace.getName(),
                        Domain.MEASUREMENT.toString(),
                        1L)
                    .getBody())
            .getItems();
    verify(mockBigQueryService).getTableFieldsFromDomain(Domain.MEASUREMENT);

    assertThat(domainWithDomainValues)
        .containsExactly(
            new DomainWithDomainValues()
                .domain(Domain.MEASUREMENT.toString())
                .addItemsItem(new DomainValue().value("field_one"))
                .addItemsItem(new DomainValue().value("field_two")));
  }

  @Test
  public void testGetValuesFromWholeGenomeDomain() {
    List<DomainWithDomainValues> domainWithDomainValues =
        Objects.requireNonNull(
                dataSetController
                    .getValuesFromDomain(
                        workspace.getNamespace(),
                        workspace.getName(),
                        Domain.WHOLE_GENOME_VARIANT.toString(),
                        1L)
                    .getBody())
            .getItems();
    assertThat(domainWithDomainValues)
        .containsExactly(
            new DomainWithDomainValues()
                .domain(Domain.WHOLE_GENOME_VARIANT.toString())
                .addItemsItem(new DomainValue().value(DataSetController.WHOLE_GENOME_VALUE)));
  }

  @Test
  public void exportToNotebook_wgsCodegen_cdrCheck() {
    DbCdrVersion cdrVersion = findCdrVersionOrThrow(workspace);
    cdrVersion.setWgsBigqueryDataset(null);
    cdrVersionDao.save(cdrVersion);

    DataSetExportRequest request =
        setUpValidDataSetExportRequest().generateGenomicsAnalysisCode(true);

    FailedPreconditionException e =
        assertThrows(
            FailedPreconditionException.class,
            () ->
                dataSetController.exportToNotebook(
                    workspace.getNamespace(), workspace.getName(), request));
    assertThat(e)
        .hasMessageThat()
        .contains("The workspace CDR version does not have whole genome data");
  }

  @Test
  public void exportToNotebook_wgsCodegen_kernelCheck() {
    DbCdrVersion cdrVersion = findCdrVersionOrThrow(workspace);
    cdrVersion.setWgsBigqueryDataset("wgs");
    cdrVersionDao.save(cdrVersion);

    DataSetExportRequest request =
        setUpValidDataSetExportRequest()
            .generateGenomicsAnalysisCode(true)
            .kernelType(KernelTypeEnum.R);

    dataSetController.exportToNotebook(workspace.getNamespace(), workspace.getName(), request);
    verify(mockNotebooksService)
        .saveNotebook(anyString(), anyString(), notebookContentsCaptor.capture());

    JSONObject notebookContents = notebookContentsCaptor.getValue();

    assertThat(notebookContents.toString())
        .contains("# Code generation for genomic analysis tools is not supported in R");
  }

  @Test
  public void getDataDictionaryEntry() {
    when(mockCdrVersionService.findByCdrVersionId(2l))
        .thenReturn(Optional.ofNullable(new DbCdrVersion()));
    when(mockDSDataDictionaryDao.findFirstByFieldNameAndDomain(anyString(), anyString()))
        .thenReturn(new DbDSDataDictionary());

    dataSetController.getDataDictionaryEntry(2l, "PERSON", "MockValue");
    verify(mockDSDataDictionaryDao, times(1)).findFirstByFieldNameAndDomain("MockValue", "PERSON");
  }

  @Test
  public void testGenomicDataExtraction_permissions() {
    cdrVersion.setWgsBigqueryDataset("wgs");
    cdrVersionDao.save(cdrVersion);

    DataSet dataSet =
        dataSetController
            .createDataSet(
                workspace.getNamespace(), workspace.getName(), buildValidDataSetRequest())
            .getBody();
    // No_Access
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.NO_ACCESS);
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () -> {
              dataSetController.extractGenomicData(
                  workspace.getNamespace(), workspace.getName(), dataSet.getId());
            });
    assertForbiddenException(exception);

    // Reader
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.READER);
    Throwable exception1 =
        assertThrows(
            ForbiddenException.class,
            () -> {
              dataSetController.extractGenomicData(
                  workspace.getNamespace(), workspace.getName(), dataSet.getId());
            });
    assertForbiddenException(exception1);

    // Writer
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.WRITER);
    dataSetController.extractGenomicData(
        workspace.getNamespace(), workspace.getName(), dataSet.getId());

    // Owner
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.OWNER);
    dataSetController.extractGenomicData(
        workspace.getNamespace(), workspace.getName(), dataSet.getId());

    // Project Owner ?
    when(fireCloudService.getWorkspace(workspace.getNamespace(), workspace.getName()))
        .thenReturn(new FirecloudWorkspaceResponse().accessLevel("PROJECT_OWNER"));
    dataSetController.extractGenomicData(
        workspace.getNamespace(), workspace.getName(), dataSet.getId());
  }

  @Test
  public void testGenomicDataExtraction_featureDisabled() {
    workbenchConfig.featureFlags.enableGenomicExtraction = false;
    assertThat(
            dataSetController
                .extractGenomicData(workspace.getNamespace(), workspace.getName(), 501L)
                .getStatusCode())
        .isEqualTo(HttpStatus.NOT_IMPLEMENTED);
  }

  @Test
  public void testGenomicDataExtraction_notFound() {
    assertThrows(
        BadRequestException.class,
        () -> {
          dataSetController.extractGenomicData(workspace.getNamespace(), workspace.getName(), 404L);
        });
  }

  @Test
  public void testGenomicDataExtraction_validCdr() throws Exception {
    cdrVersion.setWgsBigqueryDataset(null);
    cdrVersionDao.save(cdrVersion);

    DataSet dataSet =
        dataSetController
            .createDataSet(
                workspace.getNamespace(), workspace.getName(), buildValidDataSetRequest())
            .getBody();
    assertThrows(
        BadRequestException.class,
        () -> {
          dataSetController.extractGenomicData(
              workspace.getNamespace(), workspace.getName(), dataSet.getId());
        });

    cdrVersion.setWgsBigqueryDataset("wgs");
    cdrVersionDao.save(cdrVersion);

    dataSetController.extractGenomicData(
        workspace.getNamespace(), workspace.getName(), dataSet.getId());
    verify(mockGenomicExtractionService, times(1)).submitGenomicExtractionJob(any(), any());
  }

  @Test
  public void testAbortGenomicExtractionJob_readerCannotAbort() {
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.READER);
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.abortGenomicExtractionJob(
                    workspace.getNamespace(), workspace.getName(), "lol"));
    verify(mockGenomicExtractionService, times(0)).getGenomicExtractionJobs(any(), any());

    assertForbiddenException(exception);
  }

  @Test
  public void testAbortGenomicExtractionJob_noAccess() {
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.NO_ACCESS);

    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.abortGenomicExtractionJob(
                    workspace.getNamespace(), workspace.getName(), "lol"));
    verify(mockGenomicExtractionService, times(0)).getGenomicExtractionJobs(any(), any());

    assertForbiddenException(exception);
  }

  @Test
  public void testGetDataset_wrongWorkspace() {
    Workspace otherWorkspace = new Workspace();
    otherWorkspace.setName("Other Workspace");
    otherWorkspace.setResearchPurpose(new ResearchPurpose());
    otherWorkspace.setCdrVersionId(String.valueOf(cdrVersion.getCdrVersionId()));
    otherWorkspace.setBillingAccountName("billing-account");

    otherWorkspace = workspacesController.createWorkspace(otherWorkspace).getBody();

    when(fireCloudService.getWorkspace(otherWorkspace.getNamespace(), otherWorkspace.getName()))
        .thenReturn(new FirecloudWorkspaceResponse().accessLevel("OWNER"));

    Workspace finalOtherWorkspace = otherWorkspace;
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController
                .createDataSet(
                    finalOtherWorkspace.getNamespace(),
                    finalOtherWorkspace.getName(),
                    buildValidDataSetRequest())
                .getBody());
  }

  @Test
  public void testGetDataSet_noAccess() {
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.getDataSet(
                    noAccessWorkspace.getNamespace(),
                    noAccessWorkspace.getName(),
                    noAccessDataSet.getId()));

    assertForbiddenException(exception);
  }

  @Test
  public void testUpdateDataSet_noAccess() {
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.updateDataSet(
                    noAccessWorkspace.getNamespace(),
                    noAccessWorkspace.getName(),
                    noAccessDataSet.getId(),
                    new DataSetRequest().etag("1")));

    assertForbiddenException(exception);
  }

  @Test
  public void testUpdateDataSet_noAccessMismatchDataSetId() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.updateDataSet(
                workspace.getNamespace(),
                workspace.getName(),
                noAccessDataSet.getId(),
                new DataSetRequest().etag("1")));
  }

  @Test
  public void testDeleteDataSet_noAccess() {
    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.deleteDataSet(
                    noAccessWorkspace.getNamespace(),
                    noAccessWorkspace.getName(),
                    noAccessDataSet.getId()));

    assertForbiddenException(exception);
  }

  @Test
  public void testDeleteDataSet_noAccessMismatchDataSetId() {
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.deleteDataSet(
                workspace.getNamespace(), workspace.getName(), noAccessDataSet.getId()));
  }

  @Test
  public void testDeleteDataSet_success() {
    // Create several datasets to ensure we don't have an overlapping ID with a workspace, which
    // could mask bugs.
    DataSet dataSet = null;
    for (int i = 0; i < 3; i++) {
      dataSet =
          dataSetController
              .createDataSet(
                  workspace.getNamespace(), workspace.getName(), buildValidDataSetRequest())
              .getBody();
    }

    dataSetController.deleteDataSet(workspace.getNamespace(), workspace.getName(), dataSet.getId());

    DataSet finalDataSet = dataSet;
    assertThrows(
        NotFoundException.class,
        () ->
            dataSetController.getDataSet(
                workspace.getNamespace(), workspace.getName(), finalDataSet.getId()));
  }

  @Test
  public void testMarkDirty_cohort() {
    MarkDataSetRequest markDataSetRequest =
        new MarkDataSetRequest().resourceType(ResourceType.COHORT).id(cohort.getId());
    assertThat(
            dataSetController
                .markDirty(workspace.getNamespace(), workspace.getId(), markDataSetRequest)
                .getBody())
        .isTrue();
  }

  @Test
  public void testMarkDirty_concept() {
    MarkDataSetRequest markDataSetRequest =
        new MarkDataSetRequest().resourceType(ResourceType.CONCEPT_SET).id(conceptSet1.getId());
    assertThat(
            dataSetController
                .markDirty(workspace.getNamespace(), workspace.getId(), markDataSetRequest)
                .getBody())
        .isTrue();
  }

  @Test
  public void testMarkDirty_dataset() {
    MarkDataSetRequest markDataSetRequest =
        new MarkDataSetRequest().resourceType(ResourceType.DATASET).id(noAccessDataSet.getId());
    assertThat(
            dataSetController
                .markDirty(workspace.getNamespace(), workspace.getId(), markDataSetRequest)
                .getBody())
        .isTrue();
  }

  @Test
  public void testCreateDatasetMinimalOwner() {
    DataSetRequest dataSetRequest = buildEmptyDataSetRequest();
    dataSetRequest.setConceptSetIds(ImmutableList.of(conceptSet1.getId()));
    dataSetRequest.setCohortIds(ImmutableList.of(cohort.getId()));
    dataSetRequest.setDomainValuePairs(
        ImmutableList.of(new DomainValuePair().domain(Domain.CONDITION).value("some condition1")));
    // change access, call and check
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.OWNER);

    DataSet dataset =
        dataSetController
            .createDataSet(workspace.getNamespace(), workspace.getId(), dataSetRequest)
            .getBody();
    // criteriums must be empty and not null, since
    // conceptSetDao will return an empty hashSet for dbConceptEtConceptIds
    // fix workbench-api.yml#ConceptSet#criteriums array to be required
    assertThat(dataset.getConceptSets()).contains(conceptSet1);
    assertThat(dataset.getCohorts()).contains(cohort);
    assertThat(dataset.getDomainValuePairs())
        .contains(new DomainValuePair().domain(Domain.CONDITION).value("some condition1"));
  }

  @Test
  public void testCreateDatasetMinimalWriter() {
    DataSetRequest dataSetRequest = buildEmptyDataSetRequest();
    dataSetRequest.setConceptSetIds(ImmutableList.of(conceptSet1.getId()));
    dataSetRequest.setCohortIds(ImmutableList.of(cohort.getId()));
    dataSetRequest.setDomainValuePairs(
        ImmutableList.of(new DomainValuePair().domain(Domain.CONDITION).value("some condition1")));
    // change access, call and check
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.WRITER);

    DataSet dataset =
        dataSetController
            .createDataSet(workspace.getNamespace(), workspace.getId(), dataSetRequest)
            .getBody();
    // criteriums must be empty and not null, since
    // conceptSetDao will return an empty hashSet for dbConceptEtConceptIds
    // fix workbench-api.yml#ConceptSet#criteriums array to be required
    assertThat(dataset.getConceptSets()).contains(conceptSet1);
    assertThat(dataset.getCohorts()).contains(cohort);
    assertThat(dataset.getDomainValuePairs())
        .contains(new DomainValuePair().domain(Domain.CONDITION).value("some condition1"));
  }

  @Test
  public void testCreateDatasetMinimalReader() {
    DataSetRequest dataSetRequest = buildEmptyDataSetRequest();
    dataSetRequest.setConceptSetIds(ImmutableList.of(conceptSet1.getId()));
    dataSetRequest.setCohortIds(ImmutableList.of(cohort.getId()));
    dataSetRequest.setDomainValuePairs(
        ImmutableList.of(new DomainValuePair().domain(Domain.CONDITION).value("some condition1")));
    // change access, call and check
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.READER);

    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.createDataSet(
                    workspace.getNamespace(), workspace.getId(), dataSetRequest));

    assertForbiddenException(exception);
  }

  @Test
  public void testCreateDatasetMinimalNoAccess() {
    DataSetRequest dataSetRequest = buildEmptyDataSetRequest();
    dataSetRequest.setConceptSetIds(ImmutableList.of(conceptSet1.getId()));
    dataSetRequest.setCohortIds(ImmutableList.of(cohort.getId()));
    dataSetRequest.setDomainValuePairs(
        ImmutableList.of(new DomainValuePair().domain(Domain.CONDITION).value("some condition1")));
    // change access, call and check
    stubWorkspaceAccessLevel(workspace, WorkspaceAccessLevel.NO_ACCESS);

    Throwable exception =
        assertThrows(
            ForbiddenException.class,
            () ->
                dataSetController.createDataSet(
                    workspace.getNamespace(), workspace.getId(), dataSetRequest));

    assertForbiddenException(exception);
  }

  private void assertForbiddenException(Throwable exception) {
    assertThat(exception)
        .hasMessageThat()
        .containsMatch("You do not have sufficient permissions to access");
  }

  private DataSetRequest buildValidDataSetRequest() {
    return buildEmptyDataSetRequest()
        .name("blah")
        .addCohortIdsItem(cohort.getId())
        .addConceptSetIdsItem(conceptSet1.getId())
        .domainValuePairs(mockDomainValuePair());
  }

  private DataSetExportRequest setUpValidDataSetExportRequest() {
    DataSetRequest dataSet = buildValidDataSetRequest();

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery();
    String notebookName = "Hello World";

    return new DataSetExportRequest()
        .dataSetRequest(dataSet)
        .newNotebook(true)
        .notebookName(notebookName)
        .kernelType(KernelTypeEnum.PYTHON);
  }

  private DbCdrVersion findCdrVersionOrThrow(Workspace workspace) {
    String id = workspace.getCdrVersionId();
    return cdrVersionDao
        .findById(Long.parseLong(id))
        .orElseThrow(() -> new NotFoundException(String.format("CDR Version ID %s not found", id)));
  }
}
