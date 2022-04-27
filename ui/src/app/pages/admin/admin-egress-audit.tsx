import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';
import { useParams } from 'react-router';
import * as fp from 'lodash/fp';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { TabPanel, TabView } from 'primereact/tabview';

import { AuditEgressEventResponse, EgressEvent } from 'generated/fetch';

import { AdminUserLink } from 'app/components/admin/admin-user-link';
import { Button, StyledRouterLink } from 'app/components/buttons';
import { FlexRow } from 'app/components/flex';
import { WithSpinnerOverlayProps } from 'app/components/with-spinner-overlay';
import { egressEventsAdminApi } from 'app/services/swagger-fetch-clients';
import { mutableEgressEventStatuses } from 'app/utils/egress-events';
import { MatchParams } from 'app/utils/stores';

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode | string;
}) => {
  return (
    <FlexRow style={{ display: 'table-row' }}>
      <label
        style={{
          display: 'table-cell',
          fontWeight: 600,
          paddingRight: '7px',
          verticalAlign: 'top',
        }}
      >
        {label}
      </label>
      <span style={{ display: 'table-cell' }}>{children}</span>
    </FlexRow>
  );
};

const HighlightedLogMessage = ({
  logPattern,
  msg,
}: {
  logPattern: string;
  msg: string;
}) => {
  const target = logPattern.replace(/%/g, '');
  const parts = msg.split(target);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? (
            <span style={{ fontWeight: 600 }}>{target}</span>
          ) : null}
        </span>
      ))}
    </>
  );
};

export const AdminEgressAudit = (props: WithSpinnerOverlayProps) => {
  const { eventId = '' } = useParams<MatchParams>();
  const [egressDetails, setEgressDetails] =
    useState<AuditEgressEventResponse>(null);
  const [pendingUpdateEvent, setPendingUpdateEvent] =
    useState<EgressEvent>(null);
  const [activeLogGroup, setActiveLogGroup] = useState<number>(0);

  useEffect(() => {
    const aborter = new AbortController();
    (async () => {
      const resp = await egressEventsAdminApi().auditEgressEvent(
        eventId,
        {},
        {
          signal: aborter.signal,
        }
      );
      setEgressDetails(resp);
      props.hideSpinner();
    })();
    return () => aborter.abort();
  }, []);

  const onSave = useCallback(async () => {
    if (!pendingUpdateEvent) {
      return;
    }

    if (fp.isEqual(egressDetails.egressEvent, pendingUpdateEvent)) {
      return;
    }

    props.showSpinner();
    const updatedEvent = await egressEventsAdminApi().updateEgressEvent(
      pendingUpdateEvent.egressEventId,
      { egressEvent: pendingUpdateEvent }
    );
    setEgressDetails({
      ...egressDetails,
      egressEvent: updatedEvent,
    });
    setPendingUpdateEvent(null);
    props.hideSpinner();
  }, [egressDetails, pendingUpdateEvent]);

  if (!egressDetails) {
    return null;
  }

  const event = egressDetails.egressEvent;
  const eventChanged =
    !!pendingUpdateEvent && !fp.equals(pendingUpdateEvent, event);
  const [username] = event.sourceUserEmail.split('@');
  return (
    <div style={{ padding: '0 20px' }}>
      <h2>Egress event {event.egressEventId}</h2>
      <div style={{ display: 'table', marginBottom: '15px' }}>
        <DetailRow label='Detection time'>
          {new Date(event.creationTime).toLocaleString()}
        </DetailRow>
        <DetailRow label='Source user'>
          <AdminUserLink {...{ username }}>
            {event.sourceUserEmail}
          </AdminUserLink>
        </DetailRow>
        <DetailRow label='Source workspace'>
          <StyledRouterLink
            path={`/admin/workspaces/${event.sourceWorkspaceNamespace}`}
          >
            {event.sourceWorkspaceNamespace}
          </StyledRouterLink>
        </DetailRow>
        <DetailRow label='Google project'>
          {event.sourceGoogleProject}
        </DetailRow>
        <DetailRow label='Egress volume'>
          {event.egressMegabytes?.toFixed(2)} MB (over{' '}
          {event.egressWindowSeconds / 60} min)
        </DetailRow>
        <DetailRow label='Status'>
          <Dropdown
            value={pendingUpdateEvent?.status ?? event.status}
            options={mutableEgressEventStatuses}
            onChange={(e) => {
              setPendingUpdateEvent({
                ...event,
                status: e.value,
              });
            }}
            placeholder='Select a Status'
          />
        </DetailRow>
        <DetailRow label='Sumologic event'>
          <textarea
            readOnly
            style={{ width: '400px' }}
            value={JSON.stringify(egressDetails.sumologicEvent, null, 2)}
          />
        </DetailRow>
      </div>
      <FlexRow>
        <Button
          disabled={!eventChanged}
          type='secondary'
          onClick={() => setPendingUpdateEvent(null)}
        >
          Discard changes
        </Button>
        <Button
          data-test-id='save-egress-event'
          disabled={!eventChanged}
          onClick={() => onSave()}
        >
          Save
        </Button>
      </FlexRow>
      <h2>Log entries</h2>
      <TabView
        activeIndex={activeLogGroup}
        onTabChange={(e) => setActiveLogGroup(e.index)}
      >
        {egressDetails.runtimeLogGroups.map((group) => {
          let logCount = `${group.entries.length}`;
          if (group.entries.length < group.totalEntries) {
            logCount += '+';
          }
          return (
            <TabPanel key={group.name} header={`${group.name} (${logCount})`}>
              <DataTable
                paginator
                rows={50}
                rowsPerPageOptions={[50, 100, 500]}
                value={group.entries}
              >
                <Column
                  field='timestamp'
                  header='Timestamp'
                  headerStyle={{ width: '180px' }}
                  body={({ timestamp }) => new Date(timestamp).toLocaleString()}
                />
                <Column
                  field='message'
                  header='Log Message'
                  body={({ message }) => (
                    <HighlightedLogMessage
                      logPattern={group.pattern}
                      msg={message}
                    />
                  )}
                />
              </DataTable>
            </TabPanel>
          );
        })}
      </TabView>
    </div>
  );
};
