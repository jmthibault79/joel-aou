import * as React from 'react';
import { MemoryRouter, Route } from 'react-router';
import { mount, ReactWrapper } from 'enzyme';
import { Dropdown } from 'primereact/dropdown';

import {
  Authority,
  EgressEventsAdminApi,
  InstitutionalRole,
  InstitutionApi,
  Profile,
  UserAdminApi,
} from 'generated/fetch';

import { registerApiClient } from 'app/services/swagger-fetch-clients';
import {
  AccessTierDisplayNames,
  AccessTierShortNames,
} from 'app/utils/access-tiers';
import { profileStore, serverConfigStore } from 'app/utils/stores';

import defaultServerConfig from 'testing/default-server-config';
import {
  simulateComponentChange,
  simulateTextInputChange,
  waitOneTickAndUpdate,
} from 'testing/react-test-helpers';
import { EgressEventsAdminApiStub } from 'testing/stubs/egress-events-admin-api-stub';
import {
  BROAD,
  BROAD_ADDR_1,
  BROAD_ADDR_2,
  InstitutionApiStub,
  VERILY,
  VERILY_WITHOUT_CT,
} from 'testing/stubs/institution-api-stub';
import { ProfileStubVariables } from 'testing/stubs/profile-api-stub';
import { UserAdminApiStub } from 'testing/stubs/user-admin-api-stub';

import { AdminUserProfile } from './admin-user-profile';

const load = jest.fn();
const reload = jest.fn();
const updateCache = jest.fn();

const ADMIN_PROFILE: Profile = {
  ...ProfileStubVariables.PROFILE_STUB,
  authorities: [Authority.ACCESSCONTROLADMIN],
};
const TARGET_USER_PROFILE = ProfileStubVariables.PROFILE_STUB;

const updateTargetProfile = (update: Partial<Profile>) => {
  registerApiClient(
    UserAdminApi,
    new UserAdminApiStub({
      ...TARGET_USER_PROFILE,
      ...update,
    })
  );
};

const getUneditableFieldText = (
  wrapper: ReactWrapper,
  dataTestId: string
): string => {
  const divs = wrapper.find(`[data-test-id="${dataTestId}"]`).find('div');

  // sanity check: divs should contain [parent, label, value]
  expect(divs.length).toEqual(3);
  return divs.at(2).text();
};

const findDropdown = (wrapper: ReactWrapper, dataTestId: string): Dropdown =>
  wrapper
    .find(`[data-test-id="${dataTestId}"]`)
    .find(Dropdown)
    .first()
    .instance() as Dropdown;

const findTextInput = (wrapper: ReactWrapper, dataTestId: string) =>
  wrapper.find(`[data-test-id="${dataTestId}"]`).first();

describe('AdminUserProfile', () => {
  const component = (
    usernameWithoutGsuite: string = ProfileStubVariables.PROFILE_STUB.username
  ) => {
    return mount(
      <MemoryRouter
        initialEntries={[`/admin/users-tmp/${usernameWithoutGsuite}`]}
      >
        <Route path='/admin/users-tmp/:usernameWithoutGsuiteDomain'>
          <AdminUserProfile hideSpinner={() => {}} showSpinner={() => {}} />
        </Route>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    serverConfigStore.set({ config: defaultServerConfig });

    // this represents the admin user who is viewing this profile,
    // NOT the target profile being viewed
    profileStore.set({
      profile: ADMIN_PROFILE,
      load,
      reload,
      updateCache,
    });

    registerApiClient(EgressEventsAdminApi, new EgressEventsAdminApiStub());
    registerApiClient(UserAdminApi, new UserAdminApiStub());
    registerApiClient(InstitutionApi, new InstitutionApiStub());
  });

  it('should render', () => {
    const wrapper = component();
    expect(wrapper).toBeTruthy();
  });

  it("should display the user's name, username, and initial credits usage", async () => {
    const givenName = 'John Q';
    const familyName = 'Public';
    const expectedFullName = 'John Q Public';

    const username = 'some-email@yahoo.com';

    const freeTierUsage = 543.21;
    const freeTierDollarQuota = 678.99;
    const expectedCreditsText = '$543.21 used of $678.99 limit';

    updateTargetProfile({
      username,
      givenName,
      familyName,
      freeTierUsage,
      freeTierDollarQuota,
    });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(getUneditableFieldText(wrapper, 'name')).toEqual(expectedFullName);
    expect(getUneditableFieldText(wrapper, 'user-name')).toEqual(username);
    expect(getUneditableFieldText(wrapper, 'initial-credits-used')).toEqual(
      expectedCreditsText
    );
  });

  test.each([
    [
      'RT only',
      [AccessTierShortNames.Registered],
      AccessTierDisplayNames.Registered,
    ],
    [
      'CT only',
      [AccessTierShortNames.Controlled],
      AccessTierDisplayNames.Controlled,
    ],
    [
      'RT and CT',
      [AccessTierShortNames.Registered, AccessTierShortNames.Controlled],
      'Registered Tier, Controlled Tier',
    ],
    ['neither', [], 'No data access'],
  ])(
    'should display access tiers if the user has membership in %s',
    async (_, accessTierShortNames, expectedText) => {
      updateTargetProfile({ accessTierShortNames });

      const wrapper = component();
      expect(wrapper).toBeTruthy();
      await waitOneTickAndUpdate(wrapper);

      expect(getUneditableFieldText(wrapper, 'data-access-tiers')).toEqual(
        expectedText
      );
    }
  );

  it('should allow updating contactEmail within an institution', async () => {
    updateTargetProfile({ contactEmail: BROAD_ADDR_1 });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      BROAD_ADDR_1
    );

    await simulateTextInputChange(
      findTextInput(wrapper, 'contactEmail'),
      BROAD_ADDR_2
    );
    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      BROAD_ADDR_2
    );
    expect(wrapper.find('[data-test-id="email-invalid"]').exists()).toBeFalsy();

    const saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeFalsy();
  });

  it("should prohibit updating contactEmail if it doesn't match institution ADDRESSES", async () => {
    updateTargetProfile({ contactEmail: BROAD_ADDR_1 });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      BROAD_ADDR_1
    );

    const nonBroadAddr = 'PI@rival-institute.net';
    await simulateTextInputChange(
      findTextInput(wrapper, 'contactEmail'),
      nonBroadAddr
    );
    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      nonBroadAddr
    );

    const invalidEmail = wrapper.find('[data-test-id="email-invalid"]');
    expect(invalidEmail.exists()).toBeTruthy();
    expect(invalidEmail.text()).toContain(
      'The institution has authorized access only to select members.'
    );

    const saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeTruthy();
  });

  it("should prohibit updating contactEmail if it doesn't match institution DOMAINS", async () => {
    const originalAddress = 'researcher@verily.com';
    updateTargetProfile({
      verifiedInstitutionalAffiliation: {
        ...TARGET_USER_PROFILE.verifiedInstitutionalAffiliation,
        institutionShortName: VERILY.shortName,
      },
      contactEmail: originalAddress,
    });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      originalAddress
    );

    const nonVerilyAddr = 'PI@rival-institute.net';
    await simulateTextInputChange(
      findTextInput(wrapper, 'contactEmail'),
      nonVerilyAddr
    );
    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      nonVerilyAddr
    );

    const invalidEmail = wrapper.find('[data-test-id="email-invalid"]');
    expect(invalidEmail.exists()).toBeTruthy();
    expect(invalidEmail.text()).toContain(
      'Your email does not match your institution'
    );

    const saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeTruthy();
  });

  it('should allow updating institution if the email continues to match', async () => {
    const contactEmail = 'user1@google.com';
    updateTargetProfile({
      verifiedInstitutionalAffiliation: {
        ...TARGET_USER_PROFILE.verifiedInstitutionalAffiliation,
        institutionShortName: VERILY.shortName,
      },
      contactEmail,
    });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(findDropdown(wrapper, 'verifiedInstitution').props.value).toEqual(
      VERILY.shortName
    );

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'verifiedInstitution'),
      VERILY_WITHOUT_CT.shortName
    );
    expect(findDropdown(wrapper, 'verifiedInstitution').props.value).toEqual(
      VERILY_WITHOUT_CT.shortName
    );
    expect(wrapper.find('[data-test-id="email-invalid"]').exists()).toBeFalsy();

    // can't save yet - still need to set the role

    let saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeTruthy();

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'institutionalRole'),
      InstitutionalRole.POSTDOCTORAL
    );
    expect(findDropdown(wrapper, 'institutionalRole').props.value).toEqual(
      InstitutionalRole.POSTDOCTORAL
    );

    saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeFalsy();
  });

  it('should not allow updating institution if the email no longer matches', async () => {
    const contactEmail = 'user1@google.com';
    updateTargetProfile({
      verifiedInstitutionalAffiliation: {
        ...TARGET_USER_PROFILE.verifiedInstitutionalAffiliation,
        institutionShortName: VERILY.shortName,
      },
      contactEmail,
    });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(findDropdown(wrapper, 'verifiedInstitution').props.value).toEqual(
      VERILY.shortName
    );

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'verifiedInstitution'),
      BROAD.shortName
    );
    expect(findDropdown(wrapper, 'verifiedInstitution').props.value).toEqual(
      BROAD.shortName
    );
    expect(
      wrapper.find('[data-test-id="email-invalid"]').exists()
    ).toBeTruthy();

    // also need to set the Institutional Role

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'institutionalRole'),
      InstitutionalRole.POSTDOCTORAL
    );
    expect(findDropdown(wrapper, 'institutionalRole').props.value).toEqual(
      InstitutionalRole.POSTDOCTORAL
    );

    const saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeTruthy();
  });

  it('should not allow updating both email and institution if they match each other', async () => {
    const contactEmail = 'user1@google.com';
    updateTargetProfile({
      verifiedInstitutionalAffiliation: {
        ...TARGET_USER_PROFILE.verifiedInstitutionalAffiliation,
        institutionShortName: VERILY.shortName,
      },
      contactEmail,
    });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(findDropdown(wrapper, 'verifiedInstitution').props.value).toEqual(
      VERILY.shortName
    );

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'verifiedInstitution'),
      BROAD.shortName
    );
    expect(findDropdown(wrapper, 'verifiedInstitution').props.value).toEqual(
      BROAD.shortName
    );

    // also need to set the Institutional Role

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'institutionalRole'),
      InstitutionalRole.POSTDOCTORAL
    );
    expect(findDropdown(wrapper, 'institutionalRole').props.value).toEqual(
      InstitutionalRole.POSTDOCTORAL
    );

    await simulateTextInputChange(
      findTextInput(wrapper, 'contactEmail'),
      BROAD_ADDR_1
    );
    expect(findTextInput(wrapper, 'contactEmail').props().value).toEqual(
      BROAD_ADDR_1
    );

    expect(wrapper.find('[data-test-id="email-invalid"]').exists()).toBeFalsy();

    const saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeFalsy();
  });

  it('should prohibit updating institutional role to Other without adding other-text', async () => {
    const contactEmail = 'user1@google.com';
    updateTargetProfile({
      verifiedInstitutionalAffiliation: {
        ...TARGET_USER_PROFILE.verifiedInstitutionalAffiliation,
        institutionShortName: VERILY.shortName,
      },
      contactEmail,
    });

    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'institutionalRole'),
      InstitutionalRole.OTHER
    );
    expect(findDropdown(wrapper, 'institutionalRole').props.value).toEqual(
      InstitutionalRole.OTHER
    );

    let saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeTruthy();

    // now update other-text

    expect(
      findTextInput(wrapper, 'institutionalRoleOtherText').exists()
    ).toBeTruthy();
    const roleDetails = 'I do a science';
    await simulateTextInputChange(
      findTextInput(wrapper, 'institutionalRoleOtherText'),
      roleDetails
    );
    expect(
      findTextInput(wrapper, 'institutionalRoleOtherText').props().value
    ).toEqual(roleDetails);

    saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeFalsy();
  });

  it('should allow updating initial credit limit', async () => {
    const wrapper = component();
    expect(wrapper).toBeTruthy();
    await waitOneTickAndUpdate(wrapper);

    expect(
      findDropdown(wrapper, 'initial-credits-dropdown').props.value
    ).toEqual(TARGET_USER_PROFILE.freeTierDollarQuota);

    const newLimit = 800.0;
    expect(newLimit).not.toEqual(TARGET_USER_PROFILE.freeTierDollarQuota); // sanity check

    await simulateComponentChange(
      wrapper,
      findDropdown(wrapper, 'initial-credits-dropdown'),
      newLimit
    );
    expect(
      findDropdown(wrapper, 'initial-credits-dropdown').props.value
    ).toEqual(newLimit);

    const saveButton = wrapper.find('[data-test-id="update-profile"]');
    expect(saveButton.exists()).toBeTruthy();
    expect(saveButton.props().disabled).toBeFalsy();
  });
});
