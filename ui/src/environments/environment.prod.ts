import {Environment, ZendeskEnv} from 'environments/environment-type';

export const environment: Environment = {
  displayTag: '',
  shouldShowDisplayTag: false,
  allOfUsApiUrl: 'https://api.workbench.researchallofus.org',
  captchaSiteKey: '6LcsXeQUAAAAAIqvC_rqpUExWsoK4kE9siunPeCG',
  clientId: '684273740878-d7i68in5d9hqr6n9mfvrdh53snekp79f.apps.googleusercontent.com',
  leoApiUrl: 'https://notebooks.firecloud.org',
  publicUiUrl: 'https://databrowser.researchallofus.org',
  debug: false,
  gaId: 'UA-112406425-4',
  gaUserAgentDimension: 'dimension1',
  gaLoggedInDimension: 'dimension2',
  zendeskEnv: ZendeskEnv.Prod,
  shibbolethUrl: 'https://shibboleth.dsde-prod.broadinstitute.org',
  trainingUrl: 'https://aou.nnlm.gov',
  inactivityTimeoutSeconds: 30 * 60,
  inactivityWarningBeforeSeconds: 5 * 60,
  enableCaptcha: true,
  enablePublishedWorkspaces: false,
  enableProfileCapsFeatures: true,
  enableNewConceptTabs: true,
  enableFooter: true
};
