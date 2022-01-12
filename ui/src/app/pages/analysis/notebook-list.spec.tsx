import { mount } from 'enzyme';
import * as React from 'react';
import { MemoryRouter } from 'react-router';
import { NotebookList } from './notebook-list';

import { currentWorkspaceStore } from 'app/utils/navigation';
import { registerApiClient } from 'app/services/swagger-fetch-clients';
import { NotebooksApi, ProfileApi, WorkspacesApi } from 'generated/fetch';
import { ProfileApiStub } from 'testing/stubs/profile-api-stub';
import { waitOneTickAndUpdate } from 'testing/react-test-helpers';
import { workspaceDataStub, workspaceStubs } from 'testing/stubs/workspaces';
import { WorkspacesApiStub } from 'testing/stubs/workspaces-api-stub';
import { NotebooksApiStub } from 'testing/stubs/notebooks-api-stub';

describe('NotebookList', () => {
  beforeEach(() => {
    registerApiClient(WorkspacesApi, new WorkspacesApiStub());
    registerApiClient(NotebooksApi, new NotebooksApiStub());
    registerApiClient(ProfileApi, new ProfileApiStub());
  });

  it('should render notebooks', async () => {
    currentWorkspaceStore.next(workspaceDataStub);
    const wrapper = mount(
      <MemoryRouter>
        <NotebookList hideSpinner={() => {}} />
      </MemoryRouter>
    );
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find('[data-test-id="card-name"]').first().text()).toMatch(
      'mockFile'
    );
  });
});
