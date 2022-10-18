package org.pmiops.workbench.api;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.sql.Timestamp;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.pmiops.workbench.FakeClockConfiguration;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.FailedPreconditionException;
import org.pmiops.workbench.exceptions.ForbiddenException;
import org.pmiops.workbench.leonardo.ApiException;
import org.pmiops.workbench.leonardo.LeonardoApiClient;
import org.pmiops.workbench.leonardo.LeonardoApiHelper;
import org.pmiops.workbench.model.App;
import org.pmiops.workbench.model.AppType;
import org.pmiops.workbench.model.WorkspaceAccessLevel;
import org.pmiops.workbench.workspaces.WorkspaceAuthService;
import org.pmiops.workbench.workspaces.WorkspaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Scope;

@DataJpaTest
public class AppControllerTest {
  @TestConfiguration
  @Import({
    AppController.class,
    FakeClockConfiguration.class,
    LeonardoApiHelper.class,
  })
  static class Configuration {

    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    public WorkbenchConfig workbenchConfig() {
      return config;
    }

    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    DbUser user() {
      return user;
    }
  }

  @Autowired private AppController controller;

  @MockBean LeonardoApiClient mockLeonardoApiClient;
  @MockBean WorkspaceAuthService mockWorkspaceAuthService;
  @MockBean WorkspaceService mockWorkspaceService;

  private static final String GOOGLE_PROJECT_ID = "aou-gcp-id";
  private static final String WORKSPACE_NS = "workspace-ns";
  private static final String WORKSPACE_NAME = "workspace name";
  private static final String WORKSPACE_ID = "myfirstworkspace";

  private static WorkbenchConfig config = new WorkbenchConfig();
  private static DbUser user = new DbUser();
  private App testApp;

  @BeforeEach
  public void setUp() {
    config = WorkbenchConfig.createEmptyConfig();
    config.featureFlags.enableGkeApp = true;

    testApp = new App().appType(AppType.RSTUDIO).googleProject(GOOGLE_PROJECT_ID);
    DbWorkspace testWorkspace =
        new DbWorkspace()
            .setWorkspaceNamespace(WORKSPACE_NS)
            .setGoogleProject(GOOGLE_PROJECT_ID)
            .setName(WORKSPACE_NAME)
            .setFirecloudName(WORKSPACE_ID);
    doReturn(testWorkspace).when(mockWorkspaceService).lookupWorkspaceByNamespace((WORKSPACE_NS));
  }

  @Test
  public void testCreateAppSuccess() throws Exception {
    controller.createApp(WORKSPACE_NS, testApp);
    verify(mockLeonardoApiClient).createApp(testApp, WORKSPACE_NS, WORKSPACE_ID);
  }

  @Test
  public void testCreateAppFail_featureNotEnabled() throws Exception {
    config.featureFlags.enableGkeApp = false;
    assertThrows(
        UnsupportedOperationException.class, () -> controller.createApp(WORKSPACE_NS, testApp));
  }

  @Test
  public void testCreateAppFail_securitySuspended() throws ApiException {
    user.setComputeSecuritySuspendedUntil(
        Timestamp.from(FakeClockConfiguration.NOW.toInstant().plus(Duration.ofMinutes(5))));
    assertThrows(
        FailedPreconditionException.class, () -> controller.createApp(WORKSPACE_NS, testApp));
  }

  @Test
  public void testCreateAppFail_noWorkspacePermission() throws ApiException {
    doThrow(ForbiddenException.class)
        .when(mockWorkspaceAuthService)
        .enforceWorkspaceAccessLevel(WORKSPACE_NS, WORKSPACE_ID, WorkspaceAccessLevel.WRITER);

    assertThrows(ForbiddenException.class, () -> controller.createApp(WORKSPACE_NS, testApp));
  }

  @Test
  public void testCreateAppFail_validateActiveBilling() {
    doThrow(ForbiddenException.class)
        .when(mockWorkspaceAuthService)
        .validateActiveBilling(WORKSPACE_NS, WORKSPACE_ID);

    assertThrows(ForbiddenException.class, () -> controller.createApp(WORKSPACE_NS, testApp));
  }
}
