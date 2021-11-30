import * as React from 'react';
import * as fp from 'lodash';

import {Button} from 'app/components/buttons';
import {withCurrentWorkspace, withUserProfile} from 'app/utils';
import {NavigationProps} from 'app/utils/navigation';
import {serverConfigStore} from 'app/utils/stores';
import {withNavigation} from 'app/utils/with-navigation-hoc';
import {WorkspaceData} from 'app/utils/workspace-data';
import {openZendeskWidget} from 'app/utils/zendesk';
import {Profile} from 'generated/fetch';
import {ToastBanner, ToastType} from 'app/components/toast-banner';

interface Props extends NavigationProps {
  workspace: WorkspaceData;
  profileState: {
    profile: Profile
  };
  onClose: Function;
}

export const InvalidBillingBanner = fp.flow(
  withCurrentWorkspace(),
  withUserProfile(),
  withNavigation
)((props: Props) => {
  const {enableBillingUpgrade} = serverConfigStore.get().config;
  const userAction = enableBillingUpgrade ?
    'Please provide a valid billing account or contact support to extend free credits.' :
    'Please contact support to extend free credits.';
  const footer = <div style={{display: 'flex', flexDirection: 'column'}}>
    <Button style={{height: '38px', width: '70%', fontWeight: 400}}
            onClick={() => {
              openZendeskWidget(
                props.profileState.profile.givenName,
                props.profileState.profile.familyName,
                props.profileState.profile.username,
                props.profileState.profile.contactEmail,
              );
            }}
    >
      Request Extension
    </Button>
    {enableBillingUpgrade && <a
      style={{marginTop: '.5rem', marginLeft: '.2rem'}}
      onClick={() => {
        props.navigate(['workspaces', props.workspace.namespace, props.workspace.id, 'edit']);
      }}>
      Provide billing account
    </a>}
  </div>;

  return <ToastBanner
    title={'This workspace has run out of free credits'}
    message={'The free credits for the creator of this workspace have run out. ' + userAction}
    onClose={() => props.onClose()}
    type={ToastType.WARNING}
    footer={footer}
  />;
});
