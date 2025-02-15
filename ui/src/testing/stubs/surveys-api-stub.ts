import { CreateNewUserSatisfactionSurvey, SurveysApi } from 'generated/fetch';

import { stubNotImplementedError } from 'testing/stubs/stub-utils';

export class SurveysApiStub extends SurveysApi {
  constructor() {
    super(undefined, undefined, (..._: any[]) => {
      throw stubNotImplementedError;
    });
  }

  createNewUserSatisfactionSurvey(
    _newUserSatisfactionSurvey: CreateNewUserSatisfactionSurvey,
    _options?: any
  ) {
    return new Promise<Response>((resolve, _) => {
      resolve(new Response());
    });
  }
}
