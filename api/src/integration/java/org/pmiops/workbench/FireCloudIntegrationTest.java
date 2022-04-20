package org.pmiops.workbench;

import static com.google.common.truth.Truth.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.pmiops.workbench.firecloud.ApiClient;
import org.pmiops.workbench.firecloud.ApiException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.FireCloudServiceImpl;
import org.pmiops.workbench.firecloud.FirecloudApiClientFactory;
import org.pmiops.workbench.firecloud.api.NihApi;
import org.pmiops.workbench.firecloud.api.ProfileApi;
import org.pmiops.workbench.firecloud.model.FirecloudMe;
import org.pmiops.workbench.google.StorageConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Import;

public class FireCloudIntegrationTest extends BaseIntegrationTest {
  // RW-8212: This test requires that these two users keep their Terra-ToS compliance statuses
  // integration-test-user (created by gjordan) is non-compliant
  // integration-test-user-with-tos (created by thibault) is compliant
  private static final String NON_COMPLIANT_USER = "integration-test-user@fake-research-aou.org";
  private static final String COMPLIANT_USER =
      "integration-test-user-with-tos@fake-research-aou.org";
  private static final String COMPLIANT_USER_SUBJECT_ID = "265045784107300a16ccd";

  @Autowired private FireCloudService service;
  @Autowired private FirecloudApiClientFactory firecloudApiClientFactory;

  @TestConfiguration
  @ComponentScan(basePackageClasses = FireCloudServiceImpl.class)
  @Import({
    FirecloudApiClientFactory.class,
    FireCloudServiceImpl.class,
    StorageConfig.class,
    BaseIntegrationTest.Configuration.class
  })
  static class Configuration {}

  @Test
  public void testStatusProd() throws IOException {
    config = loadProdConfig();
    assertThat(service.getApiBasePath()).isEqualTo("https://api.firecloud.org");
    assertThat(service.getFirecloudStatus()).isTrue();
  }

  @Test
  public void testStatusDev() {
    assertThat(service.getApiBasePath())
        .isEqualTo("https://firecloud-orchestration.dsde-dev.broadinstitute.org");
    assertThat(service.getFirecloudStatus()).isTrue();
  }

  /**
   * Ensures we can successfully use delegation of authority to make FireCloud API calls on behalf
   * of AoU users.
   *
   * <p>This test depends on there being an active and Terms-of-Service-compliant account in
   * FireCloud dev with the matching email address.
   */
  @Test
  public void testImpersonatedProfileCall() throws Exception {
    ApiClient apiClient = firecloudApiClientFactory.newImpersonatedApiClient(COMPLIANT_USER);

    // Run the most basic API call against the /me/ endpoint.
    ProfileApi profileApi = new ProfileApi(apiClient);
    FirecloudMe me = profileApi.me();
    assertThat(me.getUserInfo().getUserEmail()).isEqualTo(COMPLIANT_USER);
    assertThat(me.getUserInfo().getUserSubjectId()).isEqualTo(COMPLIANT_USER_SUBJECT_ID);

    // Run a test against a different FireCloud endpoint. This is important, because the /me/
    // endpoint is accessible even by service accounts whose subject IDs haven't been whitelisted
    // by FireCloud devops.
    //
    // If we haven't had our "firecloud-admin" service account whitelisted,
    // then the following API call would result in a 401 error instead of a 404.
    NihApi nihApi = new NihApi(apiClient);
    int responseCode = 0;
    try {
      nihApi.nihStatus();
    } catch (ApiException e) {
      responseCode = e.getCode();
    }
    assertThat(responseCode).isEqualTo(404);
  }

  @Test
  public void testImpersonatedProfileCall_tos_non_compliant() throws Exception {
    ApiClient apiClient = firecloudApiClientFactory.newImpersonatedApiClient(NON_COMPLIANT_USER);

    // Run the most basic API call against the /me/ endpoint.  It will fail because the user is not
    // ToS-compliant.
    ProfileApi profileApi = new ProfileApi(apiClient);
    assertThrows(ApiException.class, profileApi::me);
  }
}
