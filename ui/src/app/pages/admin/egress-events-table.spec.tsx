import * as fp from 'lodash/fp';
import * as React from 'react';
import { act } from 'react-dom/test-utils';

import {
  mountWithRouter,
  waitForFakeTimersAndUpdate,
} from 'testing/react-test-helpers';
import { EgressEventsTable } from './egress-events-table';
import { EgressEventsAdminApiStub } from 'testing/stubs/egress-events-admin-api-stub';
import { registerApiClient } from 'app/services/swagger-fetch-clients';
import { EgressEventsAdminApi, EgressEventStatus } from 'generated/fetch';

describe('EgressEventsTable', () => {
  let eventsStub: EgressEventsAdminApiStub;

  beforeEach(() => {
    eventsStub = new EgressEventsAdminApiStub();
    registerApiClient(EgressEventsAdminApi, eventsStub);

    jest.useFakeTimers('modern');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render basic', async () => {
    const wrapper = mountWithRouter(<EgressEventsTable />);
    await waitForFakeTimersAndUpdate(wrapper);

    expect(wrapper.find(EgressEventsTable).exists()).toBeTruthy();
  });

  it('should render paginated', async () => {
    eventsStub.events = fp.times(() => eventsStub.simulateNewEvent(), 20);

    const wrapper = mountWithRouter(<EgressEventsTable displayPageSize={5} />);
    await waitForFakeTimersAndUpdate(wrapper);

    expect(wrapper.find(EgressEventsTable).exists()).toBeTruthy();
    expect(wrapper.find({ 'data-test-id': 'egress-event-id' }).length).toBe(5);
  });

  it('should paginate', async () => {
    eventsStub.events = fp.times(() => eventsStub.simulateNewEvent(), 100);

    const wrapper = mountWithRouter(<EgressEventsTable displayPageSize={10} />);
    await waitForFakeTimersAndUpdate(wrapper);

    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const idNodes = wrapper.find({ 'data-test-id': 'egress-event-id' });
      expect(idNodes.length).toBe(10);

      idNodes
        .map((w, _) => w.text())
        .forEach((id) => {
          ids.add(id);
        });

      act(() => {
        wrapper.find('.p-paginator-next').simulate('click');
      });
      await waitForFakeTimersAndUpdate(wrapper);
    }
    expect(wrapper.find('.p-paginator-next').prop('disabled')).toBe(true);
    expect(ids.size).toBe(100);
  });

  it('should allow event status update', async () => {
    eventsStub.events = fp.times(() => eventsStub.simulateNewEvent(), 5);

    const wrapper = mountWithRouter(<EgressEventsTable />);
    await waitForFakeTimersAndUpdate(wrapper);

    wrapper.find('.p-row-editor-init').at(2).simulate('click');
    wrapper
      .find('.p-dropdown-item')
      .find({ 'aria-label': EgressEventStatus.VERIFIEDFALSEPOSITIVE })
      .simulate('click');
    wrapper.find('.p-row-editor-save-icon').simulate('click');

    await waitForFakeTimersAndUpdate(wrapper);
    expect(eventsStub.events[2].status).toBe(
      EgressEventStatus.VERIFIEDFALSEPOSITIVE
    );
  });
});
