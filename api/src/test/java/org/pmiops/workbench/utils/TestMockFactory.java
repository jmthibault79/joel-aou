package org.pmiops.workbench.utils;

import static com.google.common.truth.Truth.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

import com.google.api.services.cloudbilling.Cloudbilling;
import com.google.api.services.cloudbilling.model.BillingAccount;
import com.google.api.services.cloudbilling.model.ListBillingAccountsResponse;
import com.google.api.services.cloudbilling.model.ProjectBillingInfo;
import com.google.common.collect.ImmutableList;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.javers.common.collections.Lists;
import org.pmiops.workbench.access.AccessTierService;
import org.pmiops.workbench.db.dao.AccessModuleDao;
import org.pmiops.workbench.db.dao.AccessTierDao;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.model.DbAccessModule;
import org.pmiops.workbench.db.model.DbAccessModule.DbAccessModuleName;
import org.pmiops.workbench.db.model.DbAccessTier;
import org.pmiops.workbench.db.model.DbCdrVersion;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbUserCodeOfConductAgreement;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceDetails;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.google.CloudBillingClient;
import org.pmiops.workbench.leonardo.model.LeonardoListRuntimeResponse;
import org.pmiops.workbench.leonardo.model.LeonardoRuntimeStatus;
import org.pmiops.workbench.model.DemographicSurveyV2;
import org.pmiops.workbench.model.DisseminateResearchEnum;
import org.pmiops.workbench.model.EducationV2;
import org.pmiops.workbench.model.EthnicCategory;
import org.pmiops.workbench.model.GenderIdentityV2;
import org.pmiops.workbench.model.ResearchOutcomeEnum;
import org.pmiops.workbench.model.ResearchPurpose;
import org.pmiops.workbench.model.SexAtBirthV2;
import org.pmiops.workbench.model.SexualOrientationV2;
import org.pmiops.workbench.model.Workspace;
import org.pmiops.workbench.model.WorkspaceAccessLevel;
import org.pmiops.workbench.model.YesNoPreferNot;

public class TestMockFactory {
  public static final String WORKSPACE_BUCKET_NAME = "fc-secure-111111-2222-AAAA-BBBB-000000000000";
  private static final String CDR_VERSION_ID = "1";
  public static final String WORKSPACE_BILLING_ACCOUNT_NAME = "billingAccounts/00000-AAAAA-BBBBB";
  private static final String WORKSPACE_FIRECLOUD_NAME =
      "gonewiththewind"; // should match workspace name w/o spaces
  public static final String DEFAULT_GOOGLE_PROJECT = "aou-rw-test-123";

  /**
   * Populate the list of expected Access Modules with appropriate properties. See
   * http://broad.io/aou-access-modules-2021.
   *
   * <p>TWO_FACTOR_AUTH and ERA_COMMONS: bypassable and not subject to AAR (expirable)
   *
   * <p>DATA_USER_CODE_OF_CONDUCT and RT_COMPLIANCE_TRAINING: bypassable and expirable
   *
   * <p>PROFILE_CONFIRMATION and PUBLICATION_CONFIRMATION: expirable and not bypassable
   *
   * <p>When considering new modules, the simplest option for implementation purposes is to make
   * them bypassable and non-expirable. So we should default to this, unless required for product
   * reasons.
   *
   * <p>RAS_LOGIN_GOV and CT_COMPLIANCE_TRAINING are bypassable and non-expirable for this reason.
   */
  public static final List<DbAccessModule> DEFAULT_ACCESS_MODULES =
      ImmutableList.of(
          new DbAccessModule()
              .setName(DbAccessModuleName.TWO_FACTOR_AUTH)
              .setExpirable(false)
              .setBypassable(true),
          new DbAccessModule()
              .setName(DbAccessModuleName.ERA_COMMONS)
              .setExpirable(false)
              .setBypassable(true),
          new DbAccessModule()
              .setName(DbAccessModuleName.RAS_LOGIN_GOV)
              .setExpirable(false)
              .setBypassable(true),
          new DbAccessModule()
              .setName(DbAccessModuleName.DATA_USER_CODE_OF_CONDUCT)
              .setExpirable(true)
              .setBypassable(true),
          new DbAccessModule()
              .setName(DbAccessModuleName.RT_COMPLIANCE_TRAINING)
              .setExpirable(true)
              .setBypassable(true),
          new DbAccessModule()
              .setName(DbAccessModuleName.CT_COMPLIANCE_TRAINING)
              .setExpirable(false)
              .setBypassable(true),
          new DbAccessModule()
              .setName(DbAccessModuleName.PROFILE_CONFIRMATION)
              .setExpirable(true)
              .setBypassable(false),
          new DbAccessModule()
              .setName(DbAccessModuleName.PUBLICATION_CONFIRMATION)
              .setExpirable(true)
              .setBypassable(false));

  // TODO there's something off about how "workspaceName" here works.  Investigate.
  // For best results, use a lowercase-only workspaceName.
  // To me, this hints at a firecloudName/aouName discrepancy somewhere in here.
  public static Workspace createWorkspace(String workspaceNameSpace, String workspaceName) {
    List<DisseminateResearchEnum> disseminateResearchEnumsList = new ArrayList<>();
    disseminateResearchEnumsList.add(DisseminateResearchEnum.PRESENATATION_SCIENTIFIC_CONFERENCES);
    disseminateResearchEnumsList.add(DisseminateResearchEnum.PRESENTATION_ADVISORY_GROUPS);

    List<ResearchOutcomeEnum> ResearchOutcomeEnumsList = new ArrayList<>();
    ResearchOutcomeEnumsList.add(ResearchOutcomeEnum.IMPROVED_RISK_ASSESMENT);

    return new Workspace()
        .id(WORKSPACE_FIRECLOUD_NAME)
        .etag("\"1\"")
        .name(workspaceName)
        .namespace(workspaceNameSpace)
        .cdrVersionId(CDR_VERSION_ID)
        .googleBucketName(WORKSPACE_BUCKET_NAME)
        .billingAccountName(WORKSPACE_BILLING_ACCOUNT_NAME)
        .googleProject(DEFAULT_GOOGLE_PROJECT)
        .creationTime(1588097211621L)
        .creator("jay@unit-test-research-aou.org")
        .creationTime(Instant.parse("2000-01-01T00:00:00.00Z").toEpochMilli())
        .lastModifiedTime(1588097211621L)
        .googleProject(DEFAULT_GOOGLE_PROJECT)
        .published(false)
        .researchPurpose(
            new ResearchPurpose()
                .additionalNotes(null)
                .diseaseFocusedResearch(true)
                .diseaseOfFocus("cancer")
                .methodsDevelopment(true)
                .controlSet(true)
                .ancestry(true)
                .commercialPurpose(true)
                .socialBehavioral(true)
                .populationHealth(true)
                .educational(true)
                .drugDevelopment(true)
                .populationDetails(Collections.emptyList())
                .additionalNotes("additional notes")
                .reasonForAllOfUs("reason for aou")
                .intendedStudy("intended study")
                .anticipatedFindings("anticipated findings")
                .timeRequested(1000L)
                .timeReviewed(1500L)
                .reviewRequested(true)
                .disseminateResearchFindingList(disseminateResearchEnumsList)
                .researchOutcomeList(ResearchOutcomeEnumsList)
                .approved(false));
  }

  public static FirecloudWorkspaceDetails createFirecloudWorkspace(
      String ns, String name, String creator) {
    return new FirecloudWorkspaceDetails()
        .namespace(ns)
        .workspaceId(ns)
        .name(name)
        .createdBy(creator)
        .bucketName(WORKSPACE_BUCKET_NAME)
        .googleProject(DEFAULT_GOOGLE_PROJECT);
  }

  public static LeonardoListRuntimeResponse createLeonardoListRuntimesResponse() {
    return new LeonardoListRuntimeResponse()
        .runtimeName("runtime")
        .googleProject("google-project")
        .status(LeonardoRuntimeStatus.STOPPED);
  }

  public static void stubCreateFcWorkspace(FireCloudService fireCloudService) {
    doAnswer(
            invocation -> {
              String capturedWorkspaceName = (String) invocation.getArguments()[1];
              String capturedWorkspaceNamespace = (String) invocation.getArguments()[0];
              FirecloudWorkspaceDetails fcWorkspace =
                  createFirecloudWorkspace(capturedWorkspaceNamespace, capturedWorkspaceName, null);

              FirecloudWorkspaceResponse fcResponse = new FirecloudWorkspaceResponse();
              fcResponse.setWorkspace(fcWorkspace);
              fcResponse.setAccessLevel(WorkspaceAccessLevel.OWNER.toString());

              doReturn(fcResponse)
                  .when(fireCloudService)
                  .getWorkspace(capturedWorkspaceNamespace, capturedWorkspaceName);
              return fcWorkspace;
            })
        .when(fireCloudService)
        .createWorkspace(anyString(), anyString(), anyString());
  }

  public static void stubCreateBillingProject(FireCloudService fireCloudService) {
    stubCreateBillingProject(fireCloudService, UUID.randomUUID().toString());
  }

  public static void stubCreateBillingProject(
      FireCloudService fireCloudService, String billingProjectId) {
    doReturn(billingProjectId).when(fireCloudService).createBillingProjectName();
  }

  public static void stubPollCloudBillingLinked(
      CloudBillingClient cloudBillingClient, String billingAccountName) {
    try {
      doReturn(new ProjectBillingInfo().setBillingEnabled(true).setName(billingAccountName))
          .when(cloudBillingClient)
          .pollUntilBillingAccountLinked(anyString(), anyString());
    } catch (IOException | InterruptedException e) {
      throw new RuntimeException(e);
    }
  }

  public static Cloudbilling createMockedCloudbilling() {
    Cloudbilling cloudbilling = mock(Cloudbilling.class);
    Cloudbilling.Projects projects = mock(Cloudbilling.Projects.class);

    doReturn(projects).when(cloudbilling).projects();

    Cloudbilling.BillingAccounts billingAccounts = mock(Cloudbilling.BillingAccounts.class);
    Cloudbilling.BillingAccounts.Get getRequest = mock(Cloudbilling.BillingAccounts.Get.class);
    Cloudbilling.BillingAccounts.List listRequest = mock(Cloudbilling.BillingAccounts.List.class);

    try {
      doReturn(new BillingAccount().setOpen(true)).when(getRequest).execute();
      doReturn(getRequest).when(billingAccounts).get(anyString());

      doReturn(new ListBillingAccountsResponse()).when(listRequest).execute();
      doReturn(listRequest).when(billingAccounts).list();
    } catch (IOException e) {
      throw new RuntimeException(e);
    }

    doReturn(billingAccounts).when(cloudbilling).billingAccounts();
    return cloudbilling;
  }

  // TODO(jaycarlton) use  WorkspaceMapper.toDbWorkspace() once it's available RW 4803
  public static DbWorkspace createDbWorkspaceStub(Workspace workspace, long workspaceDbId) {
    DbWorkspace dbWorkspace = new DbWorkspace();
    dbWorkspace.setWorkspaceId(workspaceDbId);
    dbWorkspace.setName(workspace.getName());
    dbWorkspace.setWorkspaceNamespace(workspace.getNamespace());
    // a.k.a. FirecloudWorkspaceDetails.name
    dbWorkspace.setFirecloudName(workspace.getId()); // DB_WORKSPACE_FIRECLOUD_NAME
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

    dbWorkspace.setSpecificPopulationsEnum(new HashSet<>(researchPurpose.getPopulationDetails()));
    dbWorkspace.setAdditionalNotes(researchPurpose.getAdditionalNotes());
    dbWorkspace.setReasonForAllOfUs(researchPurpose.getReasonForAllOfUs());
    dbWorkspace.setIntendedStudy(researchPurpose.getIntendedStudy());
    dbWorkspace.setAnticipatedFindings(researchPurpose.getAnticipatedFindings());
    dbWorkspace.setGoogleProject(workspace.getGoogleProject());
    return dbWorkspace;
  }

  public static DbAccessTier createRegisteredTierForTests(AccessTierDao accessTierDao) {
    final DbAccessTier accessTier =
        new DbAccessTier()
            .setAccessTierId(1)
            .setShortName(AccessTierService.REGISTERED_TIER_SHORT_NAME)
            .setDisplayName("Registered Tier")
            .setAuthDomainName("Registered Tier Auth Domain")
            .setAuthDomainGroupEmail("rt-users@fake-research-aou.org")
            .setServicePerimeter("registered/tier/perimeter")
            .setEnableUserWorkflows(false);
    return accessTierDao.save(accessTier);
  }

  public static DbAccessTier createControlledTierForTests(AccessTierDao accessTierDao) {
    return accessTierDao.save(
        new DbAccessTier()
            .setAccessTierId(2)
            .setShortName("controlled")
            .setDisplayName("Controlled Tier")
            .setAuthDomainName("Controlled Tier Auth Domain")
            .setAuthDomainGroupEmail("ct-users@fake-research-aou.org")
            .setServicePerimeter("controlled/tier/perimeter")
            .setEnableUserWorkflows(true));
  }

  public static void removeControlledTierForTests(AccessTierDao accessTierDao) {
    DbAccessTier controlledAccessTier =
        accessTierDao.findOneByShortName(AccessTierService.CONTROLLED_TIER_SHORT_NAME).get();
    accessTierDao.delete(controlledAccessTier);
  }

  /** Prepare AccessModules inmemory cache. */
  public static List<DbAccessModule> createAccessModules(AccessModuleDao accessModuleDao) {
    accessModuleDao.saveAll(DEFAULT_ACCESS_MODULES);
    return accessModuleDao.findAll();
  }

  public static DbCdrVersion createDefaultCdrVersion(
      CdrVersionDao cdrVersionDao, AccessTierDao accessTierDao) {
    return createDefaultCdrVersion(cdrVersionDao, accessTierDao, 1);
  }

  public static DbCdrVersion createDefaultCdrVersion(
      CdrVersionDao cdrVersionDao, AccessTierDao accessTierDao, long id) {
    final DbCdrVersion cdrVersion = new DbCdrVersion();
    cdrVersion.setCdrVersionId(id);
    cdrVersion.setName("1");
    // set the db name to be empty since test cases currently
    // run in the workbench schema only.
    cdrVersion.setCdrDbName("");
    cdrVersion.setAccessTier(createRegisteredTierForTests(accessTierDao));
    return cdrVersionDao.save(cdrVersion);
  }

  public static DbCdrVersion createControlledTierCdrVersion(
      CdrVersionDao cdrVersionDao, AccessTierDao accessTierDao, long id) {
    DbCdrVersion cdrVersion = createDefaultCdrVersion(cdrVersionDao, accessTierDao, id);
    cdrVersion.setAccessTier(createControlledTierForTests(accessTierDao));
    return cdrVersionDao.save(cdrVersion);
  }

  public static DbUserCodeOfConductAgreement createDuccAgreement(
      DbUser dbUser, int signedVersion, Timestamp completionTime) {
    DbUserCodeOfConductAgreement ducc = new DbUserCodeOfConductAgreement();
    ducc.setUser(dbUser);
    ducc.setSignedVersion(signedVersion);
    ducc.setUserFamilyName(dbUser.getFamilyName());
    ducc.setUserGivenName(dbUser.getGivenName());
    ducc.setUserInitials("XYZ");
    ducc.setCompletionTime(completionTime);
    return ducc;
  }

  public static DemographicSurveyV2 createDemoSurveyV2AllCategories() {
    return new DemographicSurveyV2()
        .ethnicCategories(Lists.asList(EthnicCategory.values()))
        .ethnicityAiAnOtherText("ethnicityAiAnOtherText")
        .ethnicityAsianOtherText("ethnicityAsianOtherText")
        .ethnicityBlackOtherText("ethnicityBlackOtherText")
        .ethnicityHispanicOtherText("ethnicityHispanicOtherText")
        .ethnicityMeNaOtherText("ethnicityMeNaOtherText")
        .ethnicityNhPiOtherText("ethnicityNhPiOtherText")
        .ethnicityWhiteOtherText("ethnicityWhiteOtherText")
        .ethnicityOtherText("ethnicityOtherText")
        .genderIdentities(Lists.asList(GenderIdentityV2.values()))
        .genderOtherText("genderOtherText")
        .sexualOrientations(Lists.asList(SexualOrientationV2.values()))
        .orientationOtherText("orientationOtherText")
        .sexAtBirth(SexAtBirthV2.OTHER)
        .sexAtBirthOtherText("sexAtBirthOtherText")
        .yearOfBirth(2000)
        .yearOfBirthPreferNot(false)
        .disabilityHearing(YesNoPreferNot.NO)
        .disabilitySeeing(YesNoPreferNot.YES)
        .disabilityConcentrating(YesNoPreferNot.PREFER_NOT_TO_ANSWER)
        .disabilityWalking(YesNoPreferNot.NO)
        .disabilityDressing(YesNoPreferNot.YES)
        .disabilityErrands(YesNoPreferNot.PREFER_NOT_TO_ANSWER)
        .disabilityOtherText("disabilityOtherText")
        .education(EducationV2.PREFER_NOT_TO_ANSWER)
        .disadvantaged(YesNoPreferNot.PREFER_NOT_TO_ANSWER);
  }

  public static void assertEqualDemographicSurveys(
      DemographicSurveyV2 survey1, DemographicSurveyV2 survey2) {
    assertThat(normalizeLists(survey1)).isEqualTo(normalizeLists(survey2));
  }

  // we make no guarantees about the order of the lists in DemographicSurveyV2
  // so let's normalize them for comparison
  private static DemographicSurveyV2 normalizeLists(DemographicSurveyV2 rawSurvey) {
    return rawSurvey
        .ethnicCategories(
            rawSurvey.getEthnicCategories().stream().sorted().collect(Collectors.toList()))
        .genderIdentities(
            rawSurvey.getGenderIdentities().stream().sorted().collect(Collectors.toList()))
        .sexualOrientations(
            rawSurvey.getSexualOrientations().stream().sorted().collect(Collectors.toList()));
  }
}
