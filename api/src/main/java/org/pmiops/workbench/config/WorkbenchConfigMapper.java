package org.pmiops.workbench.config;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.mapstruct.BeforeMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.pmiops.workbench.access.AccessModuleNameMapper;
import org.pmiops.workbench.db.model.DbAccessModule;
import org.pmiops.workbench.leonardo.model.LeonardoRuntimeConfig.CloudServiceEnum;
import org.pmiops.workbench.model.AccessModuleConfig;
import org.pmiops.workbench.model.ConfigResponse;
import org.pmiops.workbench.model.RuntimeImage;
import org.pmiops.workbench.utils.mappers.MapStructConfig;

@Mapper(
    config = MapStructConfig.class,
    uses = {AccessModuleNameMapper.class})
public interface WorkbenchConfigMapper {
  default RuntimeImage dataprocToModel(String imageName) {
    return new RuntimeImage().cloudService(CloudServiceEnum.DATAPROC.toString()).name(imageName);
  }

  default RuntimeImage gceToModel(String imageName) {
    return new RuntimeImage().cloudService(CloudServiceEnum.GCE.toString()).name(imageName);
  }

  @BeforeMapping
  default void mapRuntimeImages(WorkbenchConfig source, @MappingTarget ConfigResponse target) {
    target.runtimeImages(
        Stream.concat(
                source.firecloud.runtimeImages.dataproc.stream().map(this::dataprocToModel),
                source.firecloud.runtimeImages.gce.stream().map(this::gceToModel))
            .collect(Collectors.toList()));
  }

  AccessModuleConfig mapAccessModule(DbAccessModule accessModule);

  // handled by mapRuntimeImages()
  @Mapping(target = "runtimeImages", ignore = true)
  @Mapping(target = "accessRenewalLookback", source = "config.access.renewal.lookbackPeriod")
  @Mapping(target = "gsuiteDomain", source = "config.googleDirectoryService.gSuiteDomain")
  @Mapping(target = "projectId", source = "config.server.projectId")
  @Mapping(target = "firecloudURL", source = "config.firecloud.baseUrl")
  @Mapping(
      target = "publicApiKeyForErrorReports",
      source = "config.server.publicApiKeyForErrorReports")
  @Mapping(target = "shibbolethUiBaseUrl", source = "config.firecloud.shibbolethUiBaseUrl")
  @Mapping(
      target = "defaultFreeCreditsDollarLimit",
      source = "config.billing.defaultFreeCreditsDollarLimit")
  @Mapping(target = "enableComplianceTraining", source = "config.access.enableComplianceTraining")
  @Mapping(target = "complianceTrainingHost", source = "config.moodle.host")
  @Mapping(
      target = "complianceTrainingRenewalLookback",
      source = "config.access.renewal.trainingLookbackPeriod")
  @Mapping(target = "enableEraCommons", source = "config.access.enableEraCommons")
  @Mapping(target = "unsafeAllowSelfBypass", source = "config.access.unsafeAllowSelfBypass")
  @Mapping(
      target = "enableEventDateModifier",
      source = "config.featureFlags.enableEventDateModifier")
  @Mapping(
      target = "enableResearchReviewPrompt",
      source = "config.featureFlags.enableResearchPurposePrompt")
  @Mapping(target = "enableRasLoginGovLinking", source = "config.access.enableRasLoginGovLinking")
  @Mapping(target = "enforceRasLoginGovLinking", source = "config.access.enforceRasLoginGovLinking")
  @Mapping(
      target = "enableGenomicExtraction",
      source = "config.featureFlags.enableGenomicExtraction")
  @Mapping(target = "enableGpu", source = "config.featureFlags.enableGpu")
  @Mapping(target = "enablePersistentDisk", source = "config.featureFlags.enablePersistentDisk")
  @Mapping(target = "rasHost", source = "config.ras.host")
  @Mapping(target = "rasClientId", source = "config.ras.clientId")
  @Mapping(target = "rasLogoutUrl", source = "config.ras.logoutUrl")
  @Mapping(target = "freeTierBillingAccountId", source = "config.billing.accountId")
  @Mapping(target = "currentDuccVersions", source = "config.access.currentDuccVersions")
  @Mapping(
      target = "enableUpdatedDemographicSurvey",
      source = "config.featureFlags.enableUpdatedDemographicSurvey")
  @Mapping(target = "enableGkeApp", source = "config.featureFlags.enableGkeApp")
  ConfigResponse toModel(WorkbenchConfig config, List<DbAccessModule> accessModules);
}
