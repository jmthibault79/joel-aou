import {registerApiClient} from 'app/services/swagger-fetch-clients';
import {cdrVersionStore, currentWorkspaceStore, navigate, routeConfigDataStore} from 'app/utils/navigation';
import {mount} from 'enzyme';
import {Workspace, WorkspaceAccessLevel, WorkspacesApi} from 'generated/fetch';
import * as React from 'react';
import {waitOneTickAndUpdate} from 'testing/react-test-helpers';
import {cdrVersionListResponse} from 'testing/stubs/cdr-versions-api-stub';
import {WorkspacesApiStub, workspaceStubs} from 'testing/stubs/workspaces-api-stub';
import {WorkspaceEdit, WorkspaceEditMode, WorkspaceEditSection} from './workspace-edit';
import {WorkspaceData} from '../../utils/workspace-data';
import {SpecificPopulationEnum} from '../../../generated/fetch';

jest.mock('app/utils/navigation', () => ({
  ...(require.requireActual('app/utils/navigation')),
  navigate: jest.fn()
}));

let workspace: WorkspaceData;

describe('WorkspaceEdit', () => {
  let workspacesApi: WorkspacesApiStub;

  const component = () => {
    return mount(<WorkspaceEdit cancel={() => {}} />);
  };

  beforeEach(() => {
    workspace = {
      // accessLevel is a required WorkspaceData property (WorkspaceData extends
      // from Workspace)
      accessLevel: WorkspaceAccessLevel.OWNER,
      // Apply all properties from the default workspace stub.
      ...workspaceStubs[0],
      // Override some of the researchPurpose properties, to fill required
      // fields in the workspace form.
      researchPurpose: {
        ...workspaceStubs[0].researchPurpose,
        intendedStudy: 'greyscale',
        anticipatedFindings: 'everything',
        reasonForAllOfUs: 'science',
        drugDevelopment: true
      }
    };

    workspacesApi = new WorkspacesApiStub([workspace]);
    registerApiClient(WorkspacesApi, workspacesApi);

    currentWorkspaceStore.next(workspace);
    cdrVersionStore.next(cdrVersionListResponse);
    routeConfigDataStore.next({mode: WorkspaceEditMode.Create});
  });

  it('displays workspaces create page', async () => {
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find(WorkspaceEditSection).first().text()).toContain('Create a new Workspace');

    // Ensure the 'drug development' checkbox is not checked when creating.
    expect(wrapper.find('[data-test-id="drugDevelopment-checkbox"]').first().prop('checked'))
    .toEqual(false);
  });

  it('displays workspaces duplicate page', async () => {
    routeConfigDataStore.next({mode: WorkspaceEditMode.Duplicate});
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find(WorkspaceEditSection).first().text()).toContain(`Duplicate workspace "${workspace.name}"`);

    // Ensure the 'drug development' checkbox is checked when duplicating.
    expect(wrapper.find('[data-test-id="drugDevelopment-checkbox"]').first().prop('checked'))
    .toEqual(true);
  });

  it('displays workspaces edit page', async () => {
    routeConfigDataStore.next({mode: WorkspaceEditMode.Edit});
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find(WorkspaceEditSection).first().text()).toContain('Edit workspace');

    // Ensure the 'drug development' checkbox is checked when editing.
    expect(wrapper.find('[data-test-id="drugDevelopment-checkbox"]').first().prop('checked'))
      .toEqual(true);
  });

  it('pre-fills "specific populations" form elements when editing', async () => {
    // Set the workspace state to represent a workspace which is studying a
    // specific population group.
    workspace.researchPurpose.population = true;
    workspace.researchPurpose.populationDetails = [SpecificPopulationEnum.AGEGROUPS];

    routeConfigDataStore.next({mode: WorkspaceEditMode.Edit});
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    // Ensure the radiobox and checkbox are pre-filled for the "specific
    // populations" section.
    expect(wrapper.find(`[data-test-id="specific-population-yes"]`)
      .first().prop('checked')).toEqual(true);
    expect(wrapper.find(`[data-test-id="${SpecificPopulationEnum.AGEGROUPS}-checkbox"]`)
      .first().prop('checked')).toEqual(true);
  });

  it('supports successful duplication', async () => {
    routeConfigDataStore.next({mode: WorkspaceEditMode.Duplicate});
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const numBefore = workspacesApi.workspaces.length;
    wrapper.find('[data-test-id="workspace-save-btn"]').first().simulate('click');
    await waitOneTickAndUpdate(wrapper);

    expect(workspacesApi.workspaces.length).toEqual(numBefore + 1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('supports waiting on access delays', async () => {
    routeConfigDataStore.next({mode: WorkspaceEditMode.Duplicate});
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    workspacesApi.getWorkspace = (..._) => {
      return Promise.resolve({workspace, accessLevel: WorkspaceAccessLevel.NOACCESS});
    };

    jest.useFakeTimers();
    wrapper.find('[data-test-id="workspace-save-btn"]').first().simulate('click');
    await waitOneTickAndUpdate(wrapper);
    expect(navigate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(15e3);
    await waitOneTickAndUpdate(wrapper);
    expect(navigate).not.toHaveBeenCalled();

    workspacesApi.getWorkspace = (..._) => {
      return Promise.resolve({workspace, accessLevel: WorkspaceAccessLevel.OWNER});
    };
    jest.advanceTimersByTime(10e3);
    await waitOneTickAndUpdate(wrapper);
    expect(navigate).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('shows confirmation on extended access delays', async () => {
    routeConfigDataStore.next({mode: WorkspaceEditMode.Duplicate});
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    workspacesApi.getWorkspace = (..._) => {
      return Promise.resolve({workspace, accessLevel: WorkspaceAccessLevel.NOACCESS});
    };

    jest.useFakeTimers();
    wrapper.find('[data-test-id="workspace-save-btn"]').first().simulate('click');
    let aclDelayBtn;
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(20e3);
      await waitOneTickAndUpdate(wrapper);
      aclDelayBtn = wrapper.find('[data-test-id="workspace-acl-delay-btn"]').first();
      if (aclDelayBtn.exists()) {
        break;
      }
    }

    if (!aclDelayBtn.exists()) {
      fail('failed to find a rendered acl delay modal button after many timer increments');
    }
    expect(navigate).not.toHaveBeenCalled();

    aclDelayBtn.simulate('click');
    await waitOneTickAndUpdate(wrapper);
    expect(navigate).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
