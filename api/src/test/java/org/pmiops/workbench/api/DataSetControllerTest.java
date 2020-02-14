package org.pmiops.workbench.api;

import static com.google.common.truth.Truth.assertThat;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.pmiops.workbench.billing.GoogleApisConfig.END_USER_CLOUD_BILLING;
import static org.pmiops.workbench.billing.GoogleApisConfig.SERVICE_ACCOUNT_CLOUD_BILLING;

import com.google.api.services.cloudbilling.Cloudbilling;
import com.google.cloud.bigquery.Field;
import com.google.cloud.bigquery.FieldList;
import com.google.cloud.bigquery.FieldValue;
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
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.inject.Provider;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
import org.pmiops.workbench.actionaudit.auditors.UserServiceAuditor;
import org.pmiops.workbench.actionaudit.auditors.WorkspaceAuditor;
import org.pmiops.workbench.billing.BillingProjectBufferService;
import org.pmiops.workbench.billing.FreeTierBillingService;
import org.pmiops.workbench.cdr.CdrVersionService;
import org.pmiops.workbench.cdr.ConceptBigQueryService;
import org.pmiops.workbench.cdr.dao.ConceptDao;
import org.pmiops.workbench.cohortbuilder.CohortQueryBuilder;
import org.pmiops.workbench.cohorts.CohortCloningService;
import org.pmiops.workbench.cohorts.CohortFactory;
import org.pmiops.workbench.cohorts.CohortFactoryImpl;
import org.pmiops.workbench.cohorts.CohortMaterializationService;
import org.pmiops.workbench.compliance.ComplianceService;
import org.pmiops.workbench.concept.ConceptService;
import org.pmiops.workbench.conceptset.ConceptSetMapper;
import org.pmiops.workbench.conceptset.ConceptSetMapperImpl;
import org.pmiops.workbench.conceptset.ConceptSetService;
import org.pmiops.workbench.config.CdrBigQuerySchemaConfig;
import org.pmiops.workbench.config.CdrBigQuerySchemaConfigService;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.dataset.DataSetMapper;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.dao.CohortDao;
import org.pmiops.workbench.db.dao.CohortReviewDao;
import org.pmiops.workbench.db.dao.ConceptSetDao;
import org.pmiops.workbench.db.dao.DataDictionaryEntryDao;
import org.pmiops.workbench.db.dao.DataSetDao;
import org.pmiops.workbench.db.dao.DataSetService;
import org.pmiops.workbench.db.dao.DataSetServiceImpl;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.UserRecentResourceService;
import org.pmiops.workbench.db.dao.UserService;
import org.pmiops.workbench.db.dao.UserServiceImpl;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.DbBillingProjectBufferEntry;
import org.pmiops.workbench.db.model.DbCdrVersion;
import org.pmiops.workbench.db.model.DbStorageEnums;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.exceptions.ForbiddenException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspace;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACL;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceAccessEntry;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.google.CloudStorageService;
import org.pmiops.workbench.google.DirectoryService;
import org.pmiops.workbench.model.BillingStatus;
import org.pmiops.workbench.model.Cohort;
import org.pmiops.workbench.model.Concept;
import org.pmiops.workbench.model.ConceptSet;
import org.pmiops.workbench.model.CreateConceptSetRequest;
import org.pmiops.workbench.model.DataAccessLevel;
import org.pmiops.workbench.model.DataSetCodeResponse;
import org.pmiops.workbench.model.DataSetExportRequest;
import org.pmiops.workbench.model.DataSetPreviewValueList;
import org.pmiops.workbench.model.DataSetRequest;
import org.pmiops.workbench.model.Domain;
import org.pmiops.workbench.model.DomainValue;
import org.pmiops.workbench.model.DomainValuePair;
import org.pmiops.workbench.model.EmailVerificationStatus;
import org.pmiops.workbench.model.KernelTypeEnum;
import org.pmiops.workbench.model.PrePackagedConceptSetEnum;
import org.pmiops.workbench.model.ResearchPurpose;
import org.pmiops.workbench.model.SearchRequest;
import org.pmiops.workbench.model.Workspace;
import org.pmiops.workbench.model.WorkspaceAccessLevel;
import org.pmiops.workbench.model.WorkspaceActiveStatus;
import org.pmiops.workbench.monitoring.LogsBasedMetricService;
import org.pmiops.workbench.monitoring.LogsBasedMetricServiceFakeImpl;
import org.pmiops.workbench.monitoring.MonitoringService;
import org.pmiops.workbench.notebooks.NotebooksService;
import org.pmiops.workbench.test.FakeClock;
import org.pmiops.workbench.test.FakeLongRandom;
import org.pmiops.workbench.test.SearchRequests;
import org.pmiops.workbench.test.TestBigQueryCdrSchemaConfig;
import org.pmiops.workbench.utils.TestMockFactory;
import org.pmiops.workbench.utils.WorkspaceMapper;
import org.pmiops.workbench.utils.WorkspaceMapperImpl;
import org.pmiops.workbench.workspaces.ManualWorkspaceMapper;
import org.pmiops.workbench.workspaces.WorkspaceService;
import org.pmiops.workbench.workspaces.WorkspaceServiceImpl;
import org.pmiops.workbench.workspaces.WorkspacesController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Scope;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.zendesk.client.v2.Zendesk;

// TODO(jaycarlton): many of the tests here are testing DataSetServiceImpl more than
//   DataSetControllerImpl, so move those tests and setup stuff into DataSetServiceTest
//   and mock out DataSetService here.
@RunWith(SpringRunner.class)
@DataJpaTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class DataSetControllerTest {
  private static final String COHORT_ONE_NAME = "cohort";
  private static final String COHORT_TWO_NAME = "cohort two";
  private static final String CONCEPT_SET_ONE_NAME = "concept set";
  private static final String CONCEPT_SET_TWO_NAME = "concept set two";
  private static final String CONCEPT_SET_SURVEY_NAME = "concept survey set";
  private static final String WORKSPACE_NAME = "name";
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

  private Long COHORT_ONE_ID;
  private Long COHORT_TWO_ID;
  private Long CONCEPT_SET_ONE_ID;
  private Long CONCEPT_SET_TWO_ID;
  private Long CONCEPT_SET_SURVEY_ID;

  private static final Instant NOW = Instant.now();
  private static final FakeClock CLOCK = new FakeClock(NOW, ZoneId.systemDefault());
  private static DbUser currentUser;

  private String cohortCriteria;
  private SearchRequest searchRequest;
  private TestMockFactory testMockFactory;
  private Workspace workspace;

  @Autowired BillingProjectBufferService billingProjectBufferService;

  @Autowired BigQueryService bigQueryService;

  @Autowired CdrBigQuerySchemaConfigService cdrBigQuerySchemaConfigService;

  @Autowired CdrVersionDao cdrVersionDao;

  @Autowired CdrVersionService cdrVersionService;

  @Autowired CloudStorageService cloudStorageService;

  @Autowired Provider<Cloudbilling> cloudBillingProvider;

  @Autowired CohortDao cohortDao;

  @Autowired CohortFactory cohortFactory;

  @Autowired CohortMaterializationService cohortMaterializationService;

  @Autowired CohortReviewDao cohortReviewDao;

  @Autowired ConceptBigQueryService conceptBigQueryService;

  @Autowired ConceptDao conceptDao;

  @Autowired ConceptService conceptService;

  @Autowired ConceptSetService conceptSetService;

  @Autowired ConceptSetDao conceptSetDao;

  @Autowired DataDictionaryEntryDao dataDictionaryEntryDao;

  @Autowired DataSetDao dataSetDao;

  @Mock DataSetMapper dataSetMapper;

  @Autowired ConceptSetMapper conceptSetMapper;

  @Autowired DataSetService dataSetService;

  @Autowired FireCloudService fireCloudService;

  @Autowired CohortQueryBuilder cohortQueryBuilder;

  @Autowired TestBigQueryCdrSchemaConfig testBigQueryCdrSchemaConfig;

  @Autowired UserDao userDao;

  @Mock Provider<DbUser> userProvider;

  @Autowired Provider<WorkbenchConfig> workbenchConfigProvider;

  @Autowired NotebooksService notebooksService;

  @Autowired UserRecentResourceService userRecentResourceService;

  @Autowired UserService userService;

  @Autowired WorkspaceDao workspaceDao;

  @Autowired WorkspaceService workspaceService;

  @Autowired WorkspaceAuditor workspaceAuditor;

  @Autowired WorkspaceMapper workspaceMapper;

  @Autowired ManualWorkspaceMapper manualWorkspaceMapper;
  @Autowired LogsBasedMetricService logsBasedMetricService;

  @Autowired Provider<Zendesk> mockZendeskProvider;
  @MockBean MonitoringService mockMonitoringService;

  @TestConfiguration
  @Import({
    CohortFactoryImpl.class,
    ConceptService.class,
    ConceptSetMapperImpl.class,
    ConceptSetService.class,
    DataSetServiceImpl.class,
    TestBigQueryCdrSchemaConfig.class,
    UserServiceImpl.class,
    WorkspacesController.class,
    WorkspaceServiceImpl.class,
    WorkspaceMapperImpl.class,
    ManualWorkspaceMapper.class,
    LogsBasedMetricServiceFakeImpl.class
  })
  @MockBean({
    BillingProjectBufferService.class,
    BigQueryService.class,
    CdrBigQuerySchemaConfigService.class,
    CdrVersionService.class,
    CloudStorageService.class,
    CohortCloningService.class,
    CohortMaterializationService.class,
    ComplianceService.class,
    ConceptBigQueryService.class,
    DataSetService.class,
    DataSetMapper.class,
    FireCloudService.class,
    DirectoryService.class,
    NotebooksService.class,
    CohortQueryBuilder.class,
    UserRecentResourceService.class,
    WorkspaceAuditor.class,
    UserServiceAuditor.class,
    Zendesk.class,
    FreeTierBillingService.class
  })
  static class Configuration {

    @Bean(END_USER_CLOUD_BILLING)
    Cloudbilling endUserCloudbilling() {
      return TestMockFactory.createMockedCloudbilling();
    }

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
    @Scope("prototype")
    DbUser user() {
      return currentUser;
    }

    @Bean
    WorkbenchConfig workbenchConfig() {
      WorkbenchConfig workbenchConfig = new WorkbenchConfig();
      workbenchConfig.featureFlags = new WorkbenchConfig.FeatureFlagsConfig();
      workbenchConfig.featureFlags.enableBillingLockout = true;
      workbenchConfig.billing = new WorkbenchConfig.BillingConfig();
      workbenchConfig.billing.accountId = "free-tier";
      return workbenchConfig;
    }
  }

  private DataSetController dataSetController;

  @Before
  public void setUp() throws Exception {
    testMockFactory = new TestMockFactory();
    dataSetService =
        new DataSetServiceImpl(
            bigQueryService,
            cdrBigQuerySchemaConfigService,
            cohortDao,
            conceptBigQueryService,
            conceptSetDao,
            cohortQueryBuilder,
            dataSetDao);
    dataSetController =
        spy(
            new DataSetController(
                bigQueryService,
                CLOCK,
                cdrVersionDao,
                cohortDao,
                conceptService,
                conceptSetDao,
                dataDictionaryEntryDao,
                dataSetDao,
                dataSetMapper,
                dataSetService,
                fireCloudService,
                notebooksService,
                userProvider,
                workspaceService,
                conceptSetMapper));
    WorkspacesController workspacesController =
        new WorkspacesController(
            billingProjectBufferService,
            workspaceService,
            cdrVersionDao,
            userDao,
            userProvider,
            fireCloudService,
            cloudStorageService,
            cloudBillingProvider,
            mockZendeskProvider,
            CLOCK,
            notebooksService,
            userService,
            workbenchConfigProvider,
            workspaceAuditor,
            workspaceMapper,
            manualWorkspaceMapper,
            logsBasedMetricService);
    CohortsController cohortsController =
        new CohortsController(
            workspaceService,
            cohortDao,
            cdrVersionDao,
            cohortFactory,
            cohortReviewDao,
            conceptSetDao,
            cohortMaterializationService,
            userProvider,
            CLOCK,
            cdrVersionService,
            userRecentResourceService);
    ConceptSetsController conceptSetsController =
        new ConceptSetsController(
            workspaceService,
            conceptSetService,
            conceptService,
            conceptBigQueryService,
            userRecentResourceService,
            userProvider,
            CLOCK,
            conceptSetMapper);
    doAnswer(
            invocation -> {
              DbBillingProjectBufferEntry entry = mock(DbBillingProjectBufferEntry.class);
              doReturn(UUID.randomUUID().toString()).when(entry).getFireCloudProjectName();
              return entry;
            })
        .when(billingProjectBufferService)
        .assignBillingProject(any());
    testMockFactory.stubCreateFcWorkspace(fireCloudService);

    Gson gson = new Gson();
    CdrBigQuerySchemaConfig cdrBigQuerySchemaConfig =
        gson.fromJson(new FileReader("config/cdm/cdm_5_2.json"), CdrBigQuerySchemaConfig.class);

    when(cdrBigQuerySchemaConfigService.getConfig()).thenReturn(cdrBigQuerySchemaConfig);

    DbUser user = new DbUser();
    user.setUsername(USER_EMAIL);
    user.setUserId(123L);
    user.setDisabled(false);
    user.setEmailVerificationStatusEnum(EmailVerificationStatus.SUBSCRIBED);
    user = userDao.save(user);
    currentUser = user;
    when(userProvider.get()).thenReturn(user);

    DbCdrVersion cdrVersion = new DbCdrVersion();
    cdrVersion.setName("1");
    // set the db name to be empty since test cases currently
    // run in the workbench schema only.
    cdrVersion.setCdrDbName("");
    cdrVersion = cdrVersionDao.save(cdrVersion);

    workspace = new Workspace();
    workspace.setName(WORKSPACE_NAME);
    workspace.setDataAccessLevel(DataAccessLevel.PROTECTED);
    workspace.setResearchPurpose(new ResearchPurpose());
    workspace.setCdrVersionId(String.valueOf(cdrVersion.getCdrVersionId()));
    workspace.setBillingAccountName("billing-account");

    workspace = workspacesController.createWorkspace(workspace).getBody();
    stubGetWorkspace(
        workspace.getNamespace(), workspace.getName(), USER_EMAIL, WorkspaceAccessLevel.OWNER);
    stubGetWorkspaceAcl(
        workspace.getNamespace(), WORKSPACE_NAME, USER_EMAIL, WorkspaceAccessLevel.OWNER);

    searchRequest = SearchRequests.males();

    cohortCriteria = new Gson().toJson(searchRequest);

    Cohort cohort = new Cohort().name(COHORT_ONE_NAME).criteria(cohortCriteria);
    cohort =
        cohortsController.createCohort(workspace.getNamespace(), WORKSPACE_NAME, cohort).getBody();
    COHORT_ONE_ID = cohort.getId();

    Cohort cohortTwo = new Cohort().name(COHORT_TWO_NAME).criteria(cohortCriteria);
    cohortTwo =
        cohortsController
            .createCohort(workspace.getNamespace(), WORKSPACE_NAME, cohortTwo)
            .getBody();
    COHORT_TWO_ID = cohortTwo.getId();

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

    ConceptSet conceptSet =
        new ConceptSet()
            .id(CONCEPT_SET_ONE_ID)
            .name(CONCEPT_SET_ONE_NAME)
            .domain(Domain.CONDITION)
            .concepts(conceptList);

    CreateConceptSetRequest conceptSetRequest =
        new CreateConceptSetRequest()
            .conceptSet(conceptSet)
            .addedIds(conceptList.stream().map(Concept::getConceptId).collect(Collectors.toList()));

    conceptSet =
        conceptSetsController
            .createConceptSet(workspace.getNamespace(), WORKSPACE_NAME, conceptSetRequest)
            .getBody();
    CONCEPT_SET_ONE_ID = conceptSet.getId();

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
            .conceptSynonyms(new ArrayList<String>()));

    ConceptSet conceptSurveySet =
        new ConceptSet()
            .id(CONCEPT_SET_SURVEY_ID)
            .name(CONCEPT_SET_SURVEY_NAME)
            .domain(Domain.OBSERVATION)
            .concepts(conceptList);

    CreateConceptSetRequest conceptSetRequest1 =
        new CreateConceptSetRequest()
            .conceptSet(conceptSurveySet)
            .addedIds(
                conceptList.stream()
                    .map(concept -> concept.getConceptId())
                    .collect(Collectors.toList()));

    conceptSurveySet =
        conceptSetsController
            .createConceptSet(workspace.getNamespace(), WORKSPACE_NAME, conceptSetRequest1)
            .getBody();
    CONCEPT_SET_SURVEY_ID = conceptSurveySet.getId();

    ConceptSet conceptSetTwo =
        new ConceptSet()
            .id(CONCEPT_SET_TWO_ID)
            .name(CONCEPT_SET_TWO_NAME)
            .domain(Domain.DRUG)
            .concepts(conceptList);

    CreateConceptSetRequest conceptSetTwoRequest =
        new CreateConceptSetRequest()
            .conceptSet(conceptSetTwo)
            .addedIds(
                conceptList.stream()
                    .map(concept -> concept.getConceptId())
                    .collect(Collectors.toList()));

    conceptSetTwo =
        conceptSetsController
            .createConceptSet(workspace.getNamespace(), WORKSPACE_NAME, conceptSetTwoRequest)
            .getBody();
    CONCEPT_SET_TWO_ID = conceptSetTwo.getId();

    when(cohortQueryBuilder.buildParticipantIdQuery(any()))
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
    when(bigQueryService.filterBigQueryConfig(any()))
        .thenAnswer(
            (InvocationOnMock invocation) -> {
              Object[] args = invocation.getArguments();
              QueryJobConfiguration queryJobConfiguration = (QueryJobConfiguration) args[0];

              String returnSql =
                  queryJobConfiguration.getQuery().replace("${projectId}", TEST_CDR_PROJECT_ID);
              returnSql = returnSql.replace("${dataSetId}", TEST_CDR_DATA_SET_ID);
              return queryJobConfiguration.toBuilder().setQuery(returnSql).build();
            });
    when(dataSetController.generateRandomEightCharacterQualifier()).thenReturn("00000000");
  }

  private DataSetRequest buildEmptyDataSetRequest() {
    return new DataSetRequest()
        .conceptSetIds(new ArrayList<>())
        .cohortIds(new ArrayList<>())
        .domainValuePairs(new ArrayList<>())
        .name("blah")
        .prePackagedConceptSet(PrePackagedConceptSetEnum.NONE);
  }

  private void stubGetWorkspace(String ns, String name, String creator, WorkspaceAccessLevel access)
      throws Exception {
    FirecloudWorkspace fcWorkspace = new FirecloudWorkspace();
    fcWorkspace.setNamespace(ns);
    fcWorkspace.setName(name);
    fcWorkspace.setCreatedBy(creator);
    fcWorkspace.setBucketName(WORKSPACE_BUCKET_NAME);
    FirecloudWorkspaceResponse fcResponse = new FirecloudWorkspaceResponse();
    fcResponse.setWorkspace(fcWorkspace);
    fcResponse.setAccessLevel(access.toString());
    when(fireCloudService.getWorkspace(ns, name)).thenReturn(fcResponse);
  }

  private void stubGetWorkspaceAcl(
      String ns, String name, String creator, WorkspaceAccessLevel access) {
    FirecloudWorkspaceACL workspaceAccessLevelResponse = new FirecloudWorkspaceACL();
    FirecloudWorkspaceAccessEntry accessLevelEntry =
        new FirecloudWorkspaceAccessEntry().accessLevel(access.toString());
    Map<String, FirecloudWorkspaceAccessEntry> userEmailToAccessEntry =
        ImmutableMap.of(creator, accessLevelEntry);
    workspaceAccessLevelResponse.setAcl(userEmailToAccessEntry);
    when(fireCloudService.getWorkspaceAcl(ns, name)).thenReturn(workspaceAccessLevelResponse);
  }

  private List<DomainValuePair> mockDomainValuePair() {
    List<DomainValuePair> domainValues = new ArrayList<>();
    domainValues.add(new DomainValuePair().domain(Domain.CONDITION).value("PERSON_ID"));
    return domainValues;
  }

  private List<DomainValuePair> mockDomainValuePairWithPerson() {
    List<DomainValuePair> domainValues = new ArrayList<>();
    domainValues.add(new DomainValuePair().domain(Domain.PERSON).value("PERSON_ID"));
    return domainValues;
  }

  private List<DomainValuePair> mockSurveyDomainValuePair() {
    List<DomainValuePair> domainValues = new ArrayList<>();
    DomainValuePair domainValuePair = new DomainValuePair();
    domainValuePair.setDomain(Domain.OBSERVATION);
    domainValuePair.setValue("PERSON_ID");
    domainValues.add(domainValuePair);
    return domainValues;
  }

  private void mockLinkingTableQuery(ArrayList<String> domainBaseTables) {
    TableResult tableResultMock = mock(TableResult.class);
    ArrayList<FieldValueList> values = new ArrayList<>();
    domainBaseTables.forEach(
        domainBaseTable -> {
          ArrayList<Field> schemaFields = new ArrayList<>();
          schemaFields.add(Field.of("OMOP_SQL", LegacySQLTypeName.STRING));
          schemaFields.add(Field.of("JOIN_VALUE", LegacySQLTypeName.STRING));
          FieldList schema = FieldList.of(schemaFields);
          ArrayList<FieldValue> rows = new ArrayList<>();
          rows.add(FieldValue.of(FieldValue.Attribute.PRIMITIVE, "PERSON_ID"));
          rows.add(FieldValue.of(FieldValue.Attribute.PRIMITIVE, domainBaseTable));
          FieldValueList fieldValueList = FieldValueList.of(rows, schema);
          values.add(fieldValueList);
        });
    doReturn(values).when(tableResultMock).getValues();
    doReturn(tableResultMock).when(bigQueryService).executeQuery(any());
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

  @Test(expected = BadRequestException.class)
  public void testGetQueryFailsWithNoCohort() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);

    dataSetController.generateCode(
        workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet);
  }

  @Test(expected = BadRequestException.class)
  public void testGetQueryFailsWithNoConceptSet() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);

    dataSetController.generateCode(
        workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet);
  }

  @Test
  public void testGetQueryDropsQueriesWithNoValue() {
    final DataSetRequest dataSet =
        buildEmptyDataSetRequest()
            .addCohortIdsItem(COHORT_ONE_ID)
            .addConceptSetIdsItem(CONCEPT_SET_ONE_ID);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet)
            .getBody();
    assertThat(response.getCode()).isEmpty();
  }

  @Test
  public void testGetPythonQuery() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);
    List<DomainValuePair> domainValuePairs = mockDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery(tables);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet)
            .getBody();
    verify(bigQueryService, times(1)).executeQuery(any());
    String prefix = "dataset_00000000_condition_";
    assertThat(response.getCode())
        .isEqualTo(
            "import pandas\nimport os\n\n"
                + "# The ‘max_number_of_rows’ parameter limits the number of rows in the query so that the result set can fit in memory.\n"
                + "# If you increase the limit and run into responsiveness issues, please request a VM size upgrade.\n"
                + "max_number_of_rows = '1000000'\n\n"
                + "# This query represents dataset \"blah\" for domain \"condition\"\n"
                + prefix
                + "sql = \"\"\"SELECT PERSON_ID FROM `"
                + TEST_CDR_TABLE
                + ".condition_occurrence` c_occurrence WHERE \n"
                + "(condition_concept_id IN (123) OR \n"
                + "condition_source_concept_id IN (123)) \n"
                + "AND (c_occurrence.PERSON_ID IN (SELECT * FROM person_id from `"
                + TEST_CDR_TABLE
                + ".person` person WHERE "
                + NAMED_PARAMETER_VALUE.getValue()
                + " IN (2, 5))) "
                + "\n"
                + "LIMIT \"\"\" + max_number_of_rows\n"
                + "\n"
                + prefix
                + "df = pandas.read_gbq("
                + prefix
                + "sql, dialect=\"standard\")"
                + "\n"
                + "\n"
                + prefix
                + "df.head(5)");
  }

  @Test
  public void testGetRQuery() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);
    List<DomainValuePair> domainValuePairs = mockDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery(tables);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.R.toString(), dataSet)
            .getBody();
    verify(bigQueryService, times(1)).executeQuery(any());
    String prefix = "dataset_00000000_condition_";
    assertThat(response.getCode())
        .isEqualTo(
            "library(bigrquery)\n\n"
                + "# The ‘max_number_of_rows’ parameter limits the number of rows in the query so that the result set can fit in memory.\n"
                + "# If you increase the limit and run into responsiveness issues, please request a VM size upgrade.\n"
                + "max_number_of_rows = '1000000'\n\n"
                + "# This query represents dataset \"blah\" for domain \"condition\"\n"
                + prefix
                + "sql <- paste(\"SELECT PERSON_ID FROM `"
                + TEST_CDR_TABLE
                + ".condition_occurrence` c_occurrence WHERE \n"
                + "(condition_concept_id IN (123) OR \n"
                + "condition_source_concept_id IN (123)) \n"
                + "AND (c_occurrence.PERSON_ID IN (SELECT * FROM person_id from `"
                + TEST_CDR_TABLE
                + ".person` person WHERE "
                + NAMED_PARAMETER_VALUE.getValue()
                + " IN (2, 5))) \n"
                + "LIMIT \", max_number_of_rows, sep=\"\")\n"
                + "\n"
                + prefix
                + "df <- bq_table_download(bq_dataset_query(Sys.getenv(\"WORKSPACE_CDR\"), "
                + prefix
                + "sql, billing=Sys.getenv(\"GOOGLE_PROJECT\")), bigint=\"integer64\")"
                + "\n"
                + "\n"
                + "head("
                + prefix
                + "df, 5)");
  }

  @Test
  public void testGetQueryTwoDomains() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_TWO_ID);
    List<DomainValuePair> domainValuePairs = mockDomainValuePair();
    DomainValuePair drugDomainValue = new DomainValuePair();
    drugDomainValue.setDomain(Domain.DRUG);
    drugDomainValue.setValue("PERSON_ID");
    domainValuePairs.add(drugDomainValue);
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");
    tables.add("FROM `" + TEST_CDR_TABLE + ".drug_exposure` d_exposure");

    mockLinkingTableQuery(tables);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet)
            .getBody();
    verify(bigQueryService, times(2)).executeQuery(any());
    assertThat(response.getCode()).contains("condition_df");
    assertThat(response.getCode()).contains("drug_df");
  }

  @Test
  public void testGetQuerySurveyDomains() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_SURVEY_ID);
    List<DomainValuePair> domainValuePairs = mockSurveyDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".ds_survey`");

    mockLinkingTableQuery(tables);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet)
            .getBody();
    verify(bigQueryService, times(1)).executeQuery(any());
    assertThat(response.getCode()).contains("observation_df");
    assertThat(response.getCode()).contains("ds_survey");
  }

  @Test
  public void testGetQueryTwoCohorts() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addCohortIdsItem(COHORT_TWO_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);
    List<DomainValuePair> domainValuePairList = mockDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairList);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery(tables);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet)
            .getBody();
    assertThat(response.getCode()).contains("UNION DISTINCT");
  }

  @Test
  public void testGetQueryDemographic() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addCohortIdsItem(COHORT_TWO_ID);
    dataSet.setPrePackagedConceptSet(PrePackagedConceptSetEnum.DEMOGRAPHICS);
    List<DomainValuePair> domainValuePairs = new ArrayList<>();
    domainValuePairs.add(new DomainValuePair().domain(Domain.PERSON).value("GENDER"));
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".person` person");

    mockLinkingTableQuery(tables);

    DataSetCodeResponse response =
        dataSetController
            .generateCode(
                workspace.getNamespace(), WORKSPACE_NAME, KernelTypeEnum.PYTHON.toString(), dataSet)
            .getBody();
    /* this should produces the following query
       import pandas

       blah_person_sql = """SELECT PERSON_ID FROM `all-of-us-ehr-dev.synthetic_cdr20180606.person` person
       WHERE person.PERSON_ID IN (SELECT * FROM person_id from `all-of-us-ehr-dev.synthetic_cdr20180606.person`
       person UNION DISTINCT SELECT * FROM person_id from `all-of-us-ehr-dev.synthetic_cdr20180606.person` person)"""

       blah_person_query_config = {
         'query': {
         'parameterMode': 'NAMED',
         'queryParameters': [

           ]
         }
       }
    */
    assertThat(response.getCode())
        .contains(
            "person_sql = \"\"\"SELECT PERSON_ID FROM `" + TEST_CDR_TABLE + ".person` person");
    // For demographic unlike other domains WHERE should be followed by person.person_id rather than
    // concept_id
    assertThat(response.getCode()).contains("WHERE person.PERSON_ID");
  }

  @Rule public ExpectedException expectedException = ExpectedException.none();

  @Test
  public void createDataSetMissingArguments() {
    DataSetRequest dataSet = buildEmptyDataSetRequest().name(null);

    List<Long> cohortIds = new ArrayList<>();
    cohortIds.add(1l);

    List<Long> conceptIds = new ArrayList<>();
    conceptIds.add(1l);

    List<DomainValuePair> valuePairList = new ArrayList<>();
    DomainValuePair domainValue = new DomainValuePair();
    domainValue.setDomain(Domain.DRUG);
    domainValue.setValue("DRUGS_VALUE");

    valuePairList.add(domainValue);

    dataSet.setDomainValuePairs(valuePairList);
    dataSet.setConceptSetIds(conceptIds);
    dataSet.setCohortIds(cohortIds);

    expectedException.expect(BadRequestException.class);
    expectedException.expectMessage("Missing name");

    dataSetController.createDataSet(workspace.getNamespace(), WORKSPACE_NAME, dataSet);

    dataSet.setName("dataSet");
    dataSet.setCohortIds(null);

    expectedException.expect(BadRequestException.class);
    expectedException.expectMessage("Missing cohort ids");

    dataSetController.createDataSet(workspace.getNamespace(), WORKSPACE_NAME, dataSet);

    dataSet.setCohortIds(cohortIds);
    dataSet.setConceptSetIds(null);

    expectedException.expect(BadRequestException.class);
    expectedException.expectMessage("Missing concept set ids");

    dataSetController.createDataSet(workspace.getNamespace(), WORKSPACE_NAME, dataSet);

    dataSet.setConceptSetIds(conceptIds);
    dataSet.setDomainValuePairs(null);

    expectedException.expect(BadRequestException.class);
    expectedException.expectMessage("Missing values");

    dataSetController.createDataSet(workspace.getNamespace(), WORKSPACE_NAME, dataSet);
  }

  @Test
  public void exportToNewNotebook() {
    DataSetRequest dataSet = buildEmptyDataSetRequest().name("blah");
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);
    List<DomainValuePair> domainValuePairs = mockDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery(tables);
    String notebookName = "Hello World";

    DataSetExportRequest request =
        new DataSetExportRequest()
            .dataSetRequest(dataSet)
            .newNotebook(true)
            .notebookName(notebookName)
            .kernelType(KernelTypeEnum.PYTHON);

    dataSetController.exportToNotebook(workspace.getNamespace(), WORKSPACE_NAME, request).getBody();
    verify(notebooksService, never()).getNotebookContents(any(), any());
    // I tried to have this verify against the actual expected contents of the json object, but
    // java equivalence didn't handle it well.
    verify(notebooksService, times(1))
        .saveNotebook(eq(WORKSPACE_BUCKET_NAME), eq(notebookName), any(JSONObject.class));
  }

  @Test(expected = ForbiddenException.class)
  public void exportToNotebook_requiresActiveBilling() {
    DbWorkspace dbWorkspace =
        workspaceDao.findByWorkspaceNamespaceAndFirecloudNameAndActiveStatus(
            workspace.getNamespace(),
            WORKSPACE_NAME,
            DbStorageEnums.workspaceActiveStatusToStorage(WorkspaceActiveStatus.ACTIVE));
    dbWorkspace.setBillingStatus(BillingStatus.INACTIVE);
    workspaceDao.save(dbWorkspace);

    DataSetExportRequest request = new DataSetExportRequest();
    dataSetController.exportToNotebook(workspace.getNamespace(), WORKSPACE_NAME, request);
  }

  @Test
  public void exportToExistingNotebook() {
    DataSetRequest dataSet = buildEmptyDataSetRequest();
    dataSet = dataSet.addCohortIdsItem(COHORT_ONE_ID);
    dataSet = dataSet.addConceptSetIdsItem(CONCEPT_SET_ONE_ID);
    List<DomainValuePair> domainValuePairs = mockDomainValuePair();
    dataSet.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".condition_occurrence` c_occurrence");

    mockLinkingTableQuery(tables);

    String notebookName = "Hello World";

    when(notebooksService.getNotebookContents(WORKSPACE_BUCKET_NAME, notebookName))
        .thenReturn(
            new JSONObject()
                .put("cells", new JSONArray())
                .put("metadata", new JSONObject())
                .put("nbformat", 4)
                .put("nbformat_minor", 2));

    DataSetExportRequest request =
        new DataSetExportRequest()
            .dataSetRequest(dataSet)
            .newNotebook(false)
            .notebookName(notebookName);

    dataSetController.exportToNotebook(workspace.getNamespace(), WORKSPACE_NAME, request).getBody();
    verify(notebooksService, times(1)).getNotebookContents(WORKSPACE_BUCKET_NAME, notebookName);
    // I tried to have this verify against the actual expected contents of the json object, but
    // java equivalence didn't handle it well.
    verify(notebooksService, times(1))
        .saveNotebook(eq(WORKSPACE_BUCKET_NAME), eq(notebookName), any(JSONObject.class));
  }

  @Test
  public void testGetQueryPersonDomainNoConceptSets() {
    DataSetRequest dataSetRequest = buildEmptyDataSetRequest();
    dataSetRequest = dataSetRequest.addCohortIdsItem(COHORT_ONE_ID);
    List<DomainValuePair> domainValuePairs = mockDomainValuePairWithPerson();
    dataSetRequest.setDomainValuePairs(domainValuePairs);

    ArrayList<String> tables = new ArrayList<>();
    tables.add("FROM `" + TEST_CDR_TABLE + ".person` person");

    mockLinkingTableQuery(tables);

    final Map<String, QueryJobConfiguration> result =
        dataSetService.domainToBigQueryConfig(dataSetRequest);
    assertThat(result).isNotEmpty();
  }

  @Test
  public void testGetValuesFromDomain() {
    when(bigQueryService.getTableFieldsFromDomain(Domain.CONDITION))
        .thenReturn(
            FieldList.of(
                Field.of("FIELD_ONE", LegacySQLTypeName.STRING),
                Field.of("FIELD_TWO", LegacySQLTypeName.STRING)));
    List<DomainValue> domainValues =
        dataSetController
            .getValuesFromDomain(
                workspace.getNamespace(), WORKSPACE_NAME, Domain.CONDITION.toString())
            .getBody()
            .getItems();
    verify(bigQueryService).getTableFieldsFromDomain(Domain.CONDITION);

    assertThat(domainValues)
        .containsExactly(
            new DomainValue().value("FIELD_ONE"), new DomainValue().value("FIELD_TWO"));
  }

  private JSONObject createDemoCriteria() {
    JSONObject criteria = new JSONObject();
    criteria.append("includes", new JSONArray());
    criteria.append("excludes", new JSONArray());
    return criteria;
  }
}
