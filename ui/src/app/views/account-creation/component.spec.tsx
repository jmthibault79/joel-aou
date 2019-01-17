import {shallow} from 'enzyme';
import * as fp from 'lodash/fp';
import * as React from 'react';

import {
  AccountCreation,
  AccountCreationProps,
  AccountCreationState
} from './component';

let props: AccountCreationProps;
const component = () => {
  return shallow<AccountCreation,
    AccountCreationProps,
    AccountCreationState>(<AccountCreation {...props}/>);
};

beforeEach(() => {
  props = {
    invitationKey: '',
    setProfile: () => {},
  };
});

it('should handle given name validity', () => {
  const wrapper = component();
  const testInput = fp.repeat(101, 'a');
  expect(wrapper.exists('#givenName')).toBeTruthy();
  expect(wrapper.exists('#givenNameError')).toBeFalsy();
  wrapper.find('#givenName')
    .simulate('change', {target: {value: testInput}});
  wrapper.update();
  expect(wrapper.exists('#givenNameError')).toBeTruthy();
});

it ('should handle family name validity', () => {
  const wrapper = component();
  const testInput = fp.repeat(101, 'a');
  expect(wrapper.exists('#familyName')).toBeTruthy();
  expect(wrapper.exists('#familyNameError')).toBeFalsy();
  wrapper.find('#familyName').simulate('change', {target: {value: testInput}});
  expect(wrapper.exists('#familyNameError')).toBeTruthy();
});

it ('should handle organization validity', () => {
  const wrapper = component();
  const testInput = fp.repeat(300, 'a');
  expect(wrapper.exists('#organization')).toBeTruthy();
  expect(wrapper.exists('#organizationError')).toBeFalsy();
  wrapper.find('#organization').simulate('change', {target: {value: testInput}});
  expect(wrapper.exists('#organizationError')).toBeTruthy();
});

it ('should handle current position validity', () => {
  const wrapper = component();
  const testInput = fp.repeat(300, 'a');
  expect(wrapper.exists('#currentPosition')).toBeTruthy();
  expect(wrapper.exists('#currentPositionError')).toBeFalsy();
  wrapper.find('#currentPosition').simulate('change', {target: {value: testInput}});
  expect(wrapper.exists('#currentPositionError')).toBeTruthy();
});

it ('should handle username validity starts with .', () => {
  const wrapper = component();
  expect(wrapper.exists('#username')).toBeTruthy();
  expect(wrapper.exists('#usernameError')).toBeFalsy();
  expect(wrapper.exists('#usernameConflictError')).toBeFalsy();
  wrapper.find('#username').simulate('change', {target: {value: '.startswith'}});
  expect(wrapper.exists('#usernameError')).toBeTruthy();
});

it('should handle username validity ends with .', () => {
  const wrapper = component();
  expect(wrapper.exists('#username')).toBeTruthy();
  expect(wrapper.exists('#usernameError')).toBeFalsy();
  wrapper.find('#username').simulate('change', {target: {value: 'endswith.'}});
  expect(wrapper.exists('#usernameError')).toBeTruthy();
});

it('should handle username validity contains special chars', () => {
  const wrapper = component();
  expect(wrapper.exists('#username')).toBeTruthy();
  expect(wrapper.exists('#usernameError')).toBeFalsy();
  wrapper.find('#username').simulate('change', {target: {value: 'user@name'}});
  expect(wrapper.exists('#usernameError')).toBeTruthy();
});

it('should handle username validity long but has mismatch at end', () => {
  const wrapper = component();
  expect(wrapper.exists('#username')).toBeTruthy();
  expect(wrapper.exists('#usernameError')).toBeFalsy();
  // if username is long (not too long) but has a mismatch at end
  let testInput = fp.repeat(50, 'a');
  testInput = testInput + ' a';
  wrapper.find('#username').simulate('change', {target: {value: testInput}});
  expect(wrapper.exists('#usernameError')).toBeTruthy();
});

it('should handle username validity if name is valid', () => {
  const wrapper = component();
  expect(wrapper.exists('#username')).toBeTruthy();
  expect(wrapper.exists('#usernameError')).toBeFalsy();
  wrapper.find('#username').simulate('change', {target: {value: 'username'}});
  expect(wrapper.exists('#usernameError')).toBeFalsy();
});