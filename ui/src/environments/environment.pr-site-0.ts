import { Environment } from 'environments/environment-type';
import { testEnvironmentBase } from 'environments/test-env-base';

// This file is used in the deployed test environment
export const environment: Environment = {
  ...testEnvironmentBase,
  allOfUsApiUrl:
    'https://pr-0-dot-api-dot-all-of-us-workbench-test.appspot.com',
  displayTag: 'PR Site 0',
  debug: false,
};
