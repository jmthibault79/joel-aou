import {WorkspaceNavBarReact} from 'app/pages/workspace/workspace-nav-bar';
import {currentWorkspaceStore, NavStore, serverConfigStore, urlParamsStore} from 'app/utils/navigation';
import {mount} from 'enzyme';
import * as React from 'react';
import {workspaceDataStub} from 'testing/stubs/workspaces-api-stub';

describe('WorkspaceNavBarComponent', () => {

  let props: {};

  const component = () => {
    return mount(<WorkspaceNavBarReact {...props}/>, {attachTo: document.getElementById('root')});
  };

  beforeEach(() => {
    props = {};

    currentWorkspaceStore.next(workspaceDataStub);
    urlParamsStore.next({ns: workspaceDataStub.namespace, wsid: workspaceDataStub.id});
    serverConfigStore.next({
      gsuiteDomain: 'fake-research-aou.org', enableResearchReviewPrompt: true});
  });

  it('should render', () => {
    const wrapper = component();
    expect(wrapper).toBeTruthy();
  });

  it('should highlight the active tab', () => {
    props = {tabPath: 'about'};
    const wrapper = component();
    expect(wrapper.find({'data-test-id': 'About', 'aria-selected': true}).exists()).toBeTruthy();
  });

  it('should navigate on tab click', () => {
    const navSpy = jest.fn();
    NavStore.navigate = navSpy;
    const wrapper = component();

    wrapper.find({'data-test-id': 'Data'}).first().simulate('click');
    expect(navSpy).toHaveBeenCalledWith(
      ['/workspaces', workspaceDataStub.namespace, workspaceDataStub.id, 'data']);
  });

  it('should disable Data and Analysis tab if workspace require review research purpose', () => {
    const navSpy = jest.fn();
    NavStore.navigate = navSpy;
    workspaceDataStub.researchPurpose.needsReviewPrompt = true;

    const wrapper = component();

    expect(wrapper.find({'data-test-id': 'Data'}).first().props().disabled).toBeTruthy();
    expect(wrapper.find({'data-test-id': 'Analysis'}).first().props().disabled).toBeTruthy();
    expect(wrapper.find({'data-test-id': 'About'}).first().props().disabled).toBeFalsy();

  });

});
