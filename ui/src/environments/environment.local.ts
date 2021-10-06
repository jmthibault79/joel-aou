import {EnvAccessTierShortNames, Environment, ZendeskEnv} from 'environments/environment-type';
import {testEnvironmentBase} from 'environments/test-env-base';

// This file is used for a local UI server pointed at a local API server
export const environment: Environment = {
  displayTag: 'Local->Local',
  shouldShowDisplayTag: true,
  allOfUsApiUrl: 'http://localhost:8081',
  captchaSiteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
  clientId: testEnvironmentBase.clientId,
  leoApiUrl: 'https://leonardo.dsde-dev.broadinstitute.org',
  publicUiUrl: 'http://localhost:4201',
  debug: true,
  gaId: 'UA-112406425-5',
  gaUserAgentDimension: 'dimension1',
  gaLoggedInDimension: 'dimension2',
  gaUserInstitutionCategoryDimension: 'dimension3',
  zendeskEnv: ZendeskEnv.Sandbox,
  inactivityTimeoutSeconds: 99999999999,
  inactivityWarningBeforeSeconds: 5 * 60,
  allowTestAccessTokenOverride: true,
  enableCaptcha: true,
  enablePublishedWorkspaces: false,
  enableFooter: true,
  accessTiersVisibleToUsers: [EnvAccessTierShortNames.Registered, EnvAccessTierShortNames.Controlled],
};
