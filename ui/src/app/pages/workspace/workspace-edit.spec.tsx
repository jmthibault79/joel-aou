import * as React from 'react';
import { MemoryRouter } from 'react-router';
import * as fp from 'lodash/fp';
import { mount, ReactWrapper, ShallowWrapper } from 'enzyme';
import { Dropdown } from 'primereact/dropdown';
import { mockNavigate } from 'setupTests';

import {
  DisseminateResearchEnum,
  ProfileApi,
  ResearchOutcomeEnum,
  SpecificPopulationEnum,
  UserApi,
  WorkspaceAccessLevel,
  WorkspacesApi,
} from 'generated/fetch';

import {
  WorkspaceEdit,
  WorkspaceEditMode,
} from 'app/pages/workspace/workspace-edit';
import { WorkspaceEditSection } from 'app/pages/workspace/workspace-edit-section';
import { registerApiClient } from 'app/services/swagger-fetch-clients';
import { AccessTierShortNames } from 'app/utils/access-tiers';
import * as Authentication from 'app/utils/authentication';
import { currentWorkspaceStore } from 'app/utils/navigation';
import {
  cdrVersionStore,
  profileStore,
  serverConfigStore,
} from 'app/utils/stores';
import { WorkspaceData } from 'app/utils/workspace-data';

import defaultServerConfig from 'testing/default-server-config';
import {
  simulateSelection,
  waitOneTickAndUpdate,
} from 'testing/react-test-helpers';
import {
  altCdrVersion,
  CdrVersionsStubVariables,
  cdrVersionTiersResponse,
  controlledCdrVersion,
  defaultCdrVersion,
} from 'testing/stubs/cdr-versions-api-stub';
import {
  ProfileApiStub,
  ProfileStubVariables,
} from 'testing/stubs/profile-api-stub';
import { UserApiStub } from 'testing/stubs/user-api-stub';
import { workspaceStubs } from 'testing/stubs/workspaces';
import { WorkspacesApiStub } from 'testing/stubs/workspaces-api-stub';

type AnyWrapper = ShallowWrapper | ReactWrapper;

jest.mock('app/utils/workbench-gapi-client', () => ({
  getBillingAccountInfo: () =>
    new Promise((resolve) =>
      resolve({ billingAccountName: 'billing-account' })
    ),
}));

let mockHasBillingScope: jest.SpyInstance;
let mockEnsureBillingScope: jest.SpyInstance;

function getSaveButtonDisableMsg(wrapper: AnyWrapper, attributeName: string) {
  return wrapper
    .find('[data-test-id="workspace-save-btn"]')
    .first()
    .prop('disabled')[attributeName];
}

const WORKSPACE_NAME_TEXT = 'This is a text with space';

describe('WorkspaceEdit', () => {
  let workspacesApi: WorkspacesApiStub;
  let userApi: UserApiStub;
  let workspace: WorkspaceData;
  let workspaceEditMode: WorkspaceEditMode;

  const component = () => {
    return mount(
      <MemoryRouter>
        <WorkspaceEdit
          cancel={() => {}}
          hideSpinner={() => {}}
          showSpinner={() => {}}
          workspaceEditMode={workspaceEditMode}
        />
      </MemoryRouter>
    );
  };

  async function expectNoTierChangesAllowed() {
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const accessTierSelection = wrapper.find(
      '[data-test-id="select-access-tier"]'
    );
    expect(accessTierSelection.exists()).toBeTruthy();

    const selectionProps = accessTierSelection.find('select').props();
    expect(selectionProps.disabled).toBeTruthy();
    expect(selectionProps.value).toBe(workspace.accessTierShortName);
  }

  beforeEach(async () => {
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
        intendedStudy: 'intendedStudy ',
        anticipatedFindings: 'anticipatedFindings ',
        scientificApproach: 'scientificApproach ',
        drugDevelopment: true,
        disseminateResearchFindingList: [
          DisseminateResearchEnum.PUBLICATIONPERSONALBLOG,
        ],
        researchOutcomeList: [ResearchOutcomeEnum.DECREASEILLNESSBURDEN],
      },
    };

    workspaceEditMode = WorkspaceEditMode.Create;

    userApi = new UserApiStub();
    registerApiClient(UserApi, userApi);

    workspacesApi = new WorkspacesApiStub([workspace]);
    registerApiClient(WorkspacesApi, workspacesApi);

    registerApiClient(ProfileApi, new ProfileApiStub());
    profileStore.set({
      profile: ProfileStubVariables.PROFILE_STUB,
      load: jest.fn(),
      reload: jest.fn(),
      updateCache: jest.fn(),
    });
    currentWorkspaceStore.next(workspace);
    cdrVersionStore.set(cdrVersionTiersResponse);
    serverConfigStore.set({
      config: {
        ...defaultServerConfig,
        freeTierBillingAccountId: 'freetier',
        defaultFreeCreditsDollarLimit: 100.0,
        gsuiteDomain: '',
      },
    });

    mockHasBillingScope = jest.spyOn(Authentication, 'hasBillingScope');
    mockEnsureBillingScope = jest.spyOn(Authentication, 'ensureBillingScope');
    mockHasBillingScope.mockImplementation(() => false);
    mockEnsureBillingScope.mockImplementation(() => {});
  });

  it('displays workspaces create page', async () => {
    currentWorkspaceStore.next(undefined);
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find(WorkspaceEditSection).first().text()).toContain(
      'Create a new workspace'
    );

    // Ensure the 'drug development' checkbox is not checked when creating.
    expect(
      wrapper
        .find('[data-test-id="researchPurpose-checkbox"]')
        .first()
        .prop('checked')
    ).toEqual(false);

    expect(
      wrapper
        .find('[data-test-id="specific-population-no"]')
        .first()
        .prop('checked')
    ).toEqual(false);
  });

  it('displays workspaces duplicate page', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find(WorkspaceEditSection).first().text()).toContain(
      `Duplicate workspace "${workspace.name}"`
    );

    // Ensure the 'drug development' checkbox is checked when duplicating.
    expect(
      wrapper
        .find('[data-test-id="drugDevelopment-checkbox"]')
        .first()
        .prop('checked')
    ).toEqual(true);
  });

  it('displays workspaces edit page', async () => {
    workspaceEditMode = WorkspaceEditMode.Edit;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);
    expect(wrapper.find(WorkspaceEditSection).first().text()).toContain(
      'Edit workspace'
    );

    // Ensure the 'drug development' checkbox is checked when editing.
    expect(
      wrapper
        .find('[data-test-id="drugDevelopment-checkbox"]')
        .first()
        .prop('checked')
    ).toEqual(true);
  });

  it('pre-fills "specific populations" form elements when editing', async () => {
    // Set the workspace state to represent a workspace which is studying a
    // specific population group.
    workspace.researchPurpose.populationDetails = [
      SpecificPopulationEnum.AGECHILDREN,
    ];

    workspaceEditMode = WorkspaceEditMode.Edit;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    // Ensure the radiobox and checkbox are pre-filled for the "specific
    // populations" section.
    expect(
      wrapper
        .find('[data-test-id="specific-population-yes"]')
        .first()
        .prop('checked')
    ).toEqual(true);
    expect(
      wrapper
        .find(`[data-test-id="${SpecificPopulationEnum.AGECHILDREN}-checkbox"]`)
        .first()
        .prop('checked')
    ).toEqual(true);
  });

  it('should clear all selected specific populations if NO underrepresented populations study is selected', async () => {
    // Set the workspace state to represent a workspace which is studying a
    // specific population group.
    workspace.researchPurpose.populationDetails = [
      SpecificPopulationEnum.AGECHILDREN,
      SpecificPopulationEnum.RACEMENA,
      SpecificPopulationEnum.DISABILITYSTATUS,
    ];

    workspaceEditMode = WorkspaceEditMode.Edit;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    expect(
      wrapper
        .find('[data-test-id="specific-population-yes"]')
        .first()
        .prop('checked')
    ).toEqual(true);
    expect(
      wrapper
        .find(`[data-test-id="${SpecificPopulationEnum.AGECHILDREN}-checkbox"]`)
        .first()
        .prop('checked')
    ).toEqual(true);
    expect(
      wrapper
        .find(`[data-test-id="${SpecificPopulationEnum.RACEMENA}-checkbox"]`)
        .first()
        .prop('checked')
    ).toEqual(true);
    expect(
      wrapper
        .find(
          `[data-test-id="${SpecificPopulationEnum.DISABILITYSTATUS}-checkbox"]`
        )
        .first()
        .prop('checked')
    ).toEqual(true);

    wrapper
      .find('[data-test-id="specific-population-no"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="workspace-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    expect(
      workspacesApi.workspaces[0].researchPurpose.populationDetails.length
    ).toBe(0);
  });

  it('should select Research Purpose checkbox if sub category is selected', async () => {
    const wrapper = component();

    // Research Purpose should not be selected and sub categories should be collapsed by default
    expect(
      wrapper
        .find('[data-test-id="researchPurpose-checkbox"]')
        .first()
        .prop('checked')
    ).toBe(false);

    expect(
      wrapper.find('[data-test-id="research-purpose-categories"]').length
    ).toBe(0);

    // Click the arrow icon to expand the research purpose sub categories
    wrapper
      .find('[data-test-id="research-purpose-button"]')
      .first()
      .simulate('click');

    // Select any sub category for Research Purpose
    wrapper
      .find('[data-test-id="ancestry-checkbox"]')
      .first()
      .simulate('change', { target: { checked: true } });

    // Research Purpose checkbox should be selected now
    expect(
      wrapper
        .find('[data-test-id="researchPurpose-checkbox"]')
        .first()
        .prop('checked')
    ).toBe(true);

    wrapper
      .find('[data-test-id="ancestry-checkbox"]')
      .first()
      .simulate('change', { target: { checked: false } });

    // Un-selecting the sub categories should unselect the research purpose checkbox
    // BUT THE SUB CATEGORIES SHOULD STILL BE VISIBLE
    expect(
      wrapper
        .find('[data-test-id="researchPurpose-checkbox"]')
        .first()
        .prop('checked')
    ).toBe(false);
    expect(
      wrapper.find('[data-test-id="research-purpose-categories"]').length
    ).not.toBe(0);

    // Clicking the icon should collapse all the research purpose sub-categories
    wrapper
      .find('[data-test-id="research-purpose-button"]')
      .first()
      .simulate('click');
    expect(
      wrapper.find('[data-test-id="research-purpose-categories"]').length
    ).toBe(0);
  });

  it('supports disable save button if Research Outcome is not answered', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    workspace.researchPurpose.researchOutcomeList = [];
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const saveButton = wrapper
      .find('[data-test-id="workspace-save-btn"]')
      .first()
      .prop('disabled');
    expect(saveButton).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);
  });

  it('supports successful duplication in asynchronous mode', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="review-request-btn-false"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    const numBefore = workspacesApi.workspaceOperations.length;
    wrapper
      .find('[data-test-id="workspace-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);
    expect(workspacesApi.workspaceOperations.length).toEqual(numBefore + 1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('defaults to upgrading the CDR Version when asynchronously duplicating a workspace with an older CDR Version', async () => {
    // init the workspace to a non-default CDR version value
    const altCdrWorkspace = {
      ...workspace,
      cdrVersionId: CdrVersionsStubVariables.ALT_WORKSPACE_CDR_VERSION_ID,
    };
    currentWorkspaceStore.next(altCdrWorkspace);

    // duplication will involve a CDR version upgrade by default
    workspaceEditMode = WorkspaceEditMode.Duplicate;

    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const cdrSelection = wrapper
      .find('[data-test-id="select-cdr-version"]')
      .find('select')
      .props().value;

    // default CDR version, not the existing workspace's alt CDR version
    expect(cdrSelection).toBe(
      CdrVersionsStubVariables.DEFAULT_WORKSPACE_CDR_VERSION_ID
    );

    const { ALT_WORKSPACE_CDR_VERSION, DEFAULT_WORKSPACE_CDR_VERSION } =
      CdrVersionsStubVariables;
    const expectedUpgradeMessage = `${ALT_WORKSPACE_CDR_VERSION} to ${DEFAULT_WORKSPACE_CDR_VERSION}.`;
    const cdrUpgradeMessage = wrapper
      .find('[data-test-id="cdr-version-upgrade"]')
      .first()
      .text();
    expect(cdrUpgradeMessage).toContain(altCdrWorkspace.name);
    expect(cdrUpgradeMessage).toContain(expectedUpgradeMessage);
  });

  it('does not display the CDR Version upgrade message when duplicating a workspace with the latest CDR Version', async () => {
    // the standard test workspace already has the latest CDR Version but let's make it explicit with a new const
    const defaultCdrWorkspace = {
      ...workspace,
      cdrVersionId: CdrVersionsStubVariables.DEFAULT_WORKSPACE_CDR_VERSION_ID,
    };
    currentWorkspaceStore.next(defaultCdrWorkspace);

    workspaceEditMode = WorkspaceEditMode.Duplicate;

    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    // upgrade message does not appear
    expect(
      wrapper.find('[data-test-id="cdr-version-upgrade"]').exists()
    ).toBeFalsy();

    // old CDR Version warning does not appear
    expect(
      wrapper.find('[data-test-id="old-cdr-version-warning"]').exists()
    ).toBeFalsy();
  });

  it(
    'enables access tier selection on creation when multiple tiers are present' +
      ' and the user has access to multiple',
    async () => {
      const twoTiers = [
        AccessTierShortNames.Registered,
        AccessTierShortNames.Controlled,
      ];
      workspaceEditMode = WorkspaceEditMode.Create;
      profileStore.set({
        ...profileStore.get(),
        profile: {
          ...profileStore.get().profile,
          accessTierShortNames: twoTiers,
        },
      });
      const wrapper = component();
      await waitOneTickAndUpdate(wrapper);

      const accessTierSelection = wrapper
        .find('[data-test-id="select-access-tier"]')
        .find('select');
      expect(accessTierSelection.exists()).toBeTruthy();

      // defaults to registered
      const selectionProps = accessTierSelection.props();
      expect(selectionProps.disabled).toBeFalsy();
      expect(selectionProps.value).toBe(AccessTierShortNames.Registered);

      // when Registered is selected, the CDR Version dropdown lists the registered tier CDR Versions
      // defaultCdrVersion and altCdrVersion, with defaultCdrVersion selected

      const cdrVersionsSelect = () =>
        wrapper.find('[data-test-id="select-cdr-version"]').find('select');
      expect(cdrVersionsSelect().props().value).toBe(
        defaultCdrVersion.cdrVersionId
      );

      const cdrVersionSelectOptions = (): Array<string> =>
        cdrVersionsSelect()
          .children()
          .map((o) => o.props().value);
      expect(cdrVersionSelectOptions()).toEqual([
        defaultCdrVersion.cdrVersionId,
        altCdrVersion.cdrVersionId,
      ]);

      // when Controlled is selected, the CDR Version dropdown lists the (one) controlled tier CDR Version
      await simulateSelection(
        accessTierSelection,
        AccessTierShortNames.Controlled
      );

      expect(cdrVersionsSelect().props().value).toBe(
        controlledCdrVersion.cdrVersionId
      );
      expect(cdrVersionSelectOptions()).toEqual([
        controlledCdrVersion.cdrVersionId,
      ]);
    }
  );

  it(
    'enables the access tier selection dropdown on creation when multiple tiers are present' +
      ' but prevents selection when the user does not have access',
    async () => {
      workspaceEditMode = WorkspaceEditMode.Create;
      profileStore.set({
        ...profileStore.get(),
        profile: {
          ...profileStore.get().profile,
          accessTierShortNames: [AccessTierShortNames.Registered],
        },
      });

      const wrapper = component();
      await waitOneTickAndUpdate(wrapper);

      const accessTierSelection = wrapper
        .find('[data-test-id="select-access-tier"]')
        .find('select');
      expect(accessTierSelection.exists()).toBeTruthy();

      // defaults to registered
      const selectionProps = accessTierSelection.props();
      expect(selectionProps.disabled).toBeFalsy();
      expect(selectionProps.value).toBe(AccessTierShortNames.Registered);

      // when Registered is selected, the CDR Version dropdown lists the registered tier CDR Versions
      // defaultCdrVersion and altCdrVersion, with defaultCdrVersion selected

      const cdrVersionsSelect = () =>
        wrapper.find('[data-test-id="select-cdr-version"]').find('select');
      expect(cdrVersionsSelect().props().value).toBe(
        defaultCdrVersion.cdrVersionId
      );

      const cdrVersionSelectOptions = (): Array<string> =>
        cdrVersionsSelect()
          .children()
          .map((o) => o.props().value);
      expect(cdrVersionSelectOptions()).toEqual([
        defaultCdrVersion.cdrVersionId,
        altCdrVersion.cdrVersionId,
      ]);

      // when Controlled is selected, the UnavailableTierModal appears, and the CDR Version dropdown continues to
      // list the registered tier CDR Versions

      await simulateSelection(
        accessTierSelection,
        AccessTierShortNames.Controlled
      );

      expect(
        wrapper.find('[data-test-id="unavailable-tier-modal"]').exists()
      ).toBeTruthy();

      expect(cdrVersionsSelect().props().value).toBe(
        defaultCdrVersion.cdrVersionId
      );
      expect(cdrVersionSelectOptions()).toEqual([
        defaultCdrVersion.cdrVersionId,
        altCdrVersion.cdrVersionId,
      ]);
    }
  );

  it('retains the tier on edit and does not permit changes - Registered', async () => {
    workspaceEditMode = WorkspaceEditMode.Edit;
    workspace.accessTierShortName = AccessTierShortNames.Registered;
    await expectNoTierChangesAllowed();
  });

  it('retains the tier on edit and does not permit changes - Controlled', async () => {
    workspaceEditMode = WorkspaceEditMode.Edit;
    workspace.accessTierShortName = AccessTierShortNames.Controlled;
    await expectNoTierChangesAllowed();
  });

  it('retains the tier on duplication and does not permit changes - Registered', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    workspace.accessTierShortName = AccessTierShortNames.Registered;
    await expectNoTierChangesAllowed();
  });

  it('retains the tier on duplication and does not permit changes - Controlled', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    workspace.accessTierShortName = AccessTierShortNames.Controlled;
    await expectNoTierChangesAllowed();
  });

  // regression test for RW-5132 - async version
  it('prevents multiple (async) Workspace creations via the same confirmation dialog', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="review-request-btn-false"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    const numBefore = workspacesApi.workspaceOperations.length;
    wrapper
      .find('[data-test-id="workspace-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    expect(workspacesApi.workspaceOperations.length).toEqual(numBefore + 1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('supports waiting on access delays', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    workspacesApi.getWorkspace = (..._) => {
      return Promise.resolve({
        workspace,
        accessLevel: WorkspaceAccessLevel.NOACCESS,
      });
    };

    jest.useFakeTimers();
    wrapper
      .find('[data-test-id="review-request-btn-false"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);
    wrapper
      .find('[data-test-id="workspace-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);
    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);
    expect(mockNavigate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(15e3);
    await waitOneTickAndUpdate(wrapper);
    expect(mockNavigate).not.toHaveBeenCalled();

    workspacesApi.getWorkspace = (..._) => {
      return Promise.resolve({
        workspace,
        accessLevel: WorkspaceAccessLevel.OWNER,
      });
    };
    jest.advanceTimersByTime(10e3);
    await waitOneTickAndUpdate(wrapper);
    expect(mockNavigate).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('shows confirmation on extended access delays', async () => {
    workspaceEditMode = WorkspaceEditMode.Duplicate;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    workspacesApi.getWorkspace = (..._) => {
      return Promise.resolve({
        workspace,
        accessLevel: WorkspaceAccessLevel.NOACCESS,
      });
    };

    jest.useFakeTimers();
    wrapper
      .find('[data-test-id="review-request-btn-false"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);
    wrapper
      .find('[data-test-id="workspace-save-btn"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);
    wrapper
      .find('[data-test-id="workspace-confirm-save-btn"]')
      .first()
      .simulate('click');
    let aclDelayBtn;
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(20e3);
      await waitOneTickAndUpdate(wrapper);
      aclDelayBtn = wrapper
        .find('[data-test-id="workspace-acl-delay-btn"]')
        .first();
      if (aclDelayBtn.exists()) {
        break;
      }
    }

    if (!aclDelayBtn.exists()) {
      fail(
        'failed to find a rendered acl delay modal button after many timer increments'
      );
    }
    expect(mockNavigate).not.toHaveBeenCalled();

    aclDelayBtn.simulate('click');
    await waitOneTickAndUpdate(wrapper);
    expect(mockNavigate).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should disallow whitespace-only intended study text', async () => {
    const wrapper = component();
    const intendedStudySection = wrapper.find(
      '[data-test-id="intendedStudyText"]'
    );
    intendedStudySection
      .find('textarea#intendedStudyText')
      .simulate('change', { target: { value: '    ' } });

    expect(getSaveButtonDisableMsg(wrapper, 'intendedStudy')).toBeDefined();
  });

  it('should show warning message if research purpose summary Intended study have answer less than 50 characters', async () => {
    const wrapper = component();
    // Intended Study Text
    const text = 'intended Study text';
    // since its a new page the characters box for Intended study should say 1000 characters remaining
    let intendedStudySection = wrapper.find(
      '[data-test-id="intendedStudyText"]'
    );
    expect(
      intendedStudySection.find('[data-test-id="characterLimit"]').get(0).props
        .children
    ).toBe('1000 characters remaining');

    intendedStudySection
      .find('textarea#intendedStudyText')
      .simulate('change', { target: { value: text } });

    intendedStudySection = wrapper.find('[data-test-id="intendedStudyText"]');
    const charsRemaining = 1000 - text.length;

    expect(
      intendedStudySection.find('[data-test-id="characterLimit"]').get(0).props
        .children
    ).toContain(charsRemaining.toString());

    // Warning message will appear onBlur

    intendedStudySection.find('textarea#intendedStudyText').simulate('blur');
    expect(
      wrapper.find('[data-test-id="warning"]').get(0).props.children
    ).toContain('The description you entered seems too short.');
  });

  it('should show error message if research purpose summary has reached 1000 characters', async () => {
    const wrapper = component();
    // Intended Study Text
    const testInput = fp.repeat(1000, 'a');
    // since its a new page the characters box for Intended study should say 1000 characters remaining
    const intendedStudySection = wrapper.find(
      '[data-test-id="intendedStudyText"]'
    );
    expect(
      intendedStudySection.find('[data-test-id="characterLimit"]').get(0).props
        .children
    ).toBe('1000 characters remaining');

    intendedStudySection
      .find('textarea#intendedStudyText')
      .simulate('change', { target: { value: testInput } });

    wrapper.find('[data-test-id="intendedStudyText"]');

    expect(
      wrapper.find('[data-test-id="characterLimit"]').get(0).props.children
    ).toContain('0 characters remaining');
  });

  it('should show error message if Other primary purpose is more than 500 characters', async () => {
    const wrapper = component();
    expect(
      getSaveButtonDisableMsg(wrapper, 'otherPurposeDetails')
    ).toBeUndefined();
    wrapper
      .find('[data-test-id="otherPurpose-checkbox"]')
      .at(1)
      .simulate('change', { target: { checked: true } });

    expect(
      getSaveButtonDisableMsg(wrapper, 'otherPurposeDetails')
    ).toBeDefined();

    // Other Primary Purpose
    const validInput = fp.repeat(500, 'a');
    wrapper
      .find('[data-test-id="otherPrimaryPurposeText"]')
      .first()
      .simulate('change', { target: { value: validInput } });
    expect(
      getSaveButtonDisableMsg(wrapper, 'otherPurposeDetails')
    ).toBeUndefined();

    const inValidInput = fp.repeat(501, 'b');
    wrapper
      .find('[data-test-id="otherPrimaryPurposeText"]')
      .first()
      .simulate('change', { target: { value: inValidInput } });
    expect(
      getSaveButtonDisableMsg(wrapper, 'otherPurposeDetails')
    ).toBeDefined();
  });

  it('should show error message if Disease of focus is more than 80 characters', async () => {
    const wrapper = component();
    expect(getSaveButtonDisableMsg(wrapper, 'diseaseOfFocus')).toBeUndefined();

    wrapper
      .find('[data-test-id="researchPurpose-checkbox"]')
      .at(1)
      .simulate('change', { target: { checked: true } });
    wrapper
      .find('[data-test-id="diseaseFocusedResearch-checkbox"]')
      .at(1)
      .simulate('change', { target: { checked: true } });

    expect(getSaveButtonDisableMsg(wrapper, 'diseaseOfFocus')).toBeDefined();

    const validInput = fp.repeat(8, 'a');
    wrapper
      .find('[data-test-id="search-input"]')
      .first()
      .simulate('change', { target: { value: validInput } });

    expect(getSaveButtonDisableMsg(wrapper, 'diseaseOfFocus')).toBeUndefined();

    const inValidInput = fp.repeat(81, 'b');
    wrapper
      .find('[data-test-id="search-input"]')
      .first()
      .simulate('change', { target: { value: inValidInput } });
    expect(getSaveButtonDisableMsg(wrapper, 'diseaseOfFocus')).toBeDefined();
  });

  it('should show error message if Other text for disseminate research is more than 100 characters', async () => {
    const wrapper = component();
    wrapper
      .find('[data-test-id="OTHER-checkbox"]')
      .at(1)
      .simulate('change', { target: { checked: true } });
    const validInput = fp.repeat(8, 'a');
    wrapper
      .find('[data-test-id="otherDisseminateResearch-text"]')
      .first()
      .simulate('change', { target: { value: validInput } });

    expect(
      getSaveButtonDisableMsg(wrapper, 'otherDisseminateResearchFindings')
    ).toBeUndefined();
    const inValidInput = fp.repeat(101, 'b');
    wrapper
      .find('[data-test-id="otherDisseminateResearch-text"]')
      .first()
      .simulate('change', { target: { value: inValidInput } });
    expect(
      getSaveButtonDisableMsg(wrapper, 'otherDisseminateResearchFindings')
    ).toBeDefined();
  });

  it('should show error message if Other text for Special Population is more than 100 characters', async () => {
    const wrapper = component();
    expect(
      wrapper
        .find('[data-test-id="specific-population-yes"]')
        .first()
        .prop('checked')
    ).toEqual(true);
    wrapper
      .find('[data-test-id="other-specialPopulation-checkbox"]')
      .at(1)
      .simulate('change', { target: { checked: true } });

    const validInput = fp.repeat(100, 'a');
    wrapper
      .find('[data-test-id="other-specialPopulation-text"]')
      .first()
      .simulate('change', { target: { value: validInput } });

    expect(
      getSaveButtonDisableMsg(wrapper, 'otherPopulationDetails')
    ).toBeUndefined();

    const inValidInput = fp.repeat(101, 'a');
    wrapper
      .find('[data-test-id="other-specialPopulation-text"]')
      .first()
      .simulate('change', { target: { value: inValidInput } });

    expect(
      getSaveButtonDisableMsg(wrapper, 'otherPopulationDetails')
    ).toBeDefined();
  });

  it('should show error message when other disseminate checked but empty', async () => {
    const wrapper = component();
    wrapper
      .find('[data-test-id="OTHER-checkbox"]')
      .at(1)
      .simulate('change', { target: { checked: true } });
    const validInput = fp.repeat(8, 'a');
    wrapper
      .find('[data-test-id="otherDisseminateResearch-text"]')
      .first()
      .simulate('change', { target: { value: validInput } });

    expect(
      getSaveButtonDisableMsg(wrapper, 'otherDisseminateResearchFindings')
    ).toBeUndefined();
    const inValidInput = fp.repeat(8, ' ');
    wrapper
      .find('[data-test-id="otherDisseminateResearch-text"]')
      .first()
      .simulate('change', { target: { value: inValidInput } });
    expect(
      getSaveButtonDisableMsg(wrapper, 'otherDisseminateResearchFindings')
    ).toBeDefined();
  });

  it('should show free tier then user billing when user not granting then grant billing scope', async () => {
    workspaceEditMode = WorkspaceEditMode.Create;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    let billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;

    expect(mockEnsureBillingScope).toHaveBeenCalledTimes(0);
    expect(billingDropDown.props.value).toEqual('billingAccounts/freetier');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'billingAccounts/freetier',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'Use All of Us initial credits - $33.33 left',
    ]);

    // Now select SELECT_OR_CREATE_BILLING_ACCOUNT_OPTION_VALUE, expect request billing scope then show the
    // real billing accounts user has access to.
    mockHasBillingScope.mockImplementation(() => true);

    wrapper
      .find('[data-test-id="billing-dropdown-div"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;
    expect(mockEnsureBillingScope).toHaveBeenCalledTimes(1);
    expect(billingDropDown.props.value).toEqual('free-tier');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'free-tier',
      'user-billing',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'Use All of Us initial credits - $33.33 left',
      'User Billing',
    ]);
  });

  it('should show free tier user account and user-billing when user granted billing scope', async () => {
    mockHasBillingScope.mockImplementation(() => true);
    workspaceEditMode = WorkspaceEditMode.Create;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;

    expect(billingDropDown.props.value).toEqual('free-tier');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'free-tier',
      'user-billing',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'Use All of Us initial credits - $33.33 left',
      'User Billing',
    ]);
  });

  it('should show free tier and user billing account when they grant billing scope when creating workspace', async () => {
    mockHasBillingScope.mockImplementation(() => true);
    workspaceEditMode = WorkspaceEditMode.Create;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;

    expect(mockEnsureBillingScope).toHaveBeenCalledTimes(0);
    expect(billingDropDown.props.value).toEqual('free-tier');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'free-tier',
      'user-billing',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'Use All of Us initial credits - $33.33 left',
      'User Billing',
    ]);
  });

  it('should show User Provided Billing Account when user does not have permission on the billing account workspace is using', async () => {
    mockHasBillingScope.mockImplementation(() => true);
    workspaceEditMode = WorkspaceEditMode.Edit;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    const billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;

    expect(mockEnsureBillingScope).toHaveBeenCalledTimes(0);
    // 'billing-account' is workspace's current billing account.
    // There would be 3 options: Free tier, user's billing account, workspace billing account
    expect(billingDropDown.props.value).toEqual('billing-account');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'free-tier',
      'user-billing',
      'billing-account',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'Use All of Us initial credits - $33.33 left',
      'User Billing',
      'User Provided Billing Account',
    ]);
  });

  it('should show user provided text when they not granting billing scope when editing workspace', async () => {
    workspaceEditMode = WorkspaceEditMode.Edit;
    const wrapper = component();
    await waitOneTickAndUpdate(wrapper);

    let billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;

    expect(mockEnsureBillingScope).toHaveBeenCalledTimes(0);
    // 'billing-account' is workspace's current billing account.
    // There would be 4 options: Free tier, user's billing account, workspace billing account
    expect(billingDropDown.props.value).toEqual('billing-account');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'billing-account',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'User Provided Billing Account',
    ]);

    // Now select SELECT_OR_CREATE_BILLING_ACCOUNT_OPTION_VALUE, expect request billing scope then show the
    // real billing accounts user has access to.
    mockHasBillingScope.mockImplementation(() => true);
    wrapper
      .find('[data-test-id="billing-dropdown-div"]')
      .first()
      .simulate('click');
    await waitOneTickAndUpdate(wrapper);

    billingDropDown = wrapper
      .find('[data-test-id="billing-dropdown"]')
      .instance() as Dropdown;
    expect(mockEnsureBillingScope).toHaveBeenCalledTimes(1);
    expect(billingDropDown.props.value).toEqual('billing-account');
    expect(billingDropDown.props.options.map((o) => o.value)).toEqual([
      'free-tier',
      'user-billing',
      'billing-account',
    ]);
    expect(billingDropDown.props.options.map((o) => o.label)).toEqual([
      'Use All of Us initial credits - $33.33 left',
      'User Billing',
      'User Provided Billing Account',
    ]);
  });
  it('Should trim workspace name', async () => {
    const wrapper = component();
    let workspaceNameTextBox = wrapper
      .find('[data-test-id="workspace-name"]')
      .first();
    workspaceNameTextBox.simulate('change', {
      target: { value: '  ' + WORKSPACE_NAME_TEXT + '    ' },
    });
    expect(workspaceNameTextBox.prop('value')).not.toBe(WORKSPACE_NAME_TEXT);
    workspaceNameTextBox.simulate('blur');
    workspaceNameTextBox = wrapper
      .find('[data-test-id="workspace-name"]')
      .first();
    expect(workspaceNameTextBox.prop('value')).toBe(WORKSPACE_NAME_TEXT);
  });
});
