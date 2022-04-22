import * as React from 'react';
import { Redirect, Switch } from 'react-router-dom';
import * as fp from 'lodash/fp';

import {
  AppRoute,
  withFullHeight,
  withRouteData,
} from 'app/components/app-router';
import { BreadcrumbType } from 'app/components/breadcrumb-type';
import { withRoutingSpinner } from 'app/components/with-routing-spinner';
import { AccessRenewal } from 'app/pages/access/access-renewal';
import { DataAccessRequirements } from 'app/pages/access/data-access-requirements';
import { AdminBanner } from 'app/pages/admin/admin-banner';
import { AdminEgressAudit } from 'app/pages/admin/admin-egress-audit';
import { AdminEgressEvents } from 'app/pages/admin/admin-egress-events';
import { AdminInstitution } from 'app/pages/admin/admin-institution';
import { AdminInstitutionEdit } from 'app/pages/admin/admin-institution-edit';
import { AdminNotebookView } from 'app/pages/admin/admin-notebook-view';
import { AdminUser } from 'app/pages/admin/admin-user';
import { AdminUserAccess } from 'app/pages/admin/admin-user-access';
import { AdminUserProfile } from 'app/pages/admin/admin-user-profile';
import { AdminUsers } from 'app/pages/admin/admin-users';
import { AdminWorkspace } from 'app/pages/admin/admin-workspace';
import { WorkspaceAudit } from 'app/pages/admin/admin-workspace-audit';
import { AdminWorkspaceSearch } from 'app/pages/admin/admin-workspace-search';
import { UserAudit } from 'app/pages/admin/user-audit';
import { Homepage } from 'app/pages/homepage/homepage';
import { DataUserCodeOfConduct } from 'app/pages/profile/data-user-code-of-conduct';
import { ProfileComponent } from 'app/pages/profile/profile-component';
import {
  WorkspaceEdit,
  WorkspaceEditMode,
} from 'app/pages/workspace/workspace-edit';
import { WorkspaceLibrary } from 'app/pages/workspace/workspace-library';
import { WorkspaceList } from 'app/pages/workspace/workspace-list';
import { WorkspaceWrapper } from 'app/pages/workspace/workspace-wrapper';
import {
  ACCESS_RENEWAL_PATH,
  DATA_ACCESS_REQUIREMENTS_PATH,
  NIH_CALLBACK_PATH,
  RAS_CALLBACK_PATH,
} from 'app/utils/access-utils';
import { AuthorityGuardedAction } from 'app/utils/authorities';

import { authorityGuard, getAccessModuleGuard } from './guards';

const AccessRenewalPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AccessRenewal);
const AdminBannerPage = fp.flow(withRouteData, withRoutingSpinner)(AdminBanner);
const AdminNotebookViewPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminNotebookView);
const AdminEgressAuditPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminEgressAudit);
const AdminEgressEventsPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminEgressEvents);
const DataAccessRequirementsPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(DataAccessRequirements);
const DataUserCodeOfConductPage = fp.flow(
  withRouteData,
  withFullHeight,
  withRoutingSpinner
)(DataUserCodeOfConduct);
const HomepagePage = fp.flow(withRouteData, withRoutingSpinner)(Homepage);
const InstitutionAdminPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminInstitution);
const InstitutionEditAdminPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminInstitutionEdit);
const ProfilePage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(ProfileComponent);
const UserAdminPage = fp.flow(withRouteData, withRoutingSpinner)(AdminUser);
const UserAdminProfilePage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminUserProfile);
const UsersAdminPage = fp.flow(withRouteData, withRoutingSpinner)(AdminUsers);
const UserAuditPage = fp.flow(withRouteData, withRoutingSpinner)(UserAudit);
const UserAccessPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminUserAccess);
const WorkspaceWrapperPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(WorkspaceWrapper);
const WorkspaceAdminPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminWorkspace);
const WorkspaceAuditPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(WorkspaceAudit);
const WorkspaceEditPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(WorkspaceEdit);
const WorkspaceLibraryPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(WorkspaceLibrary);
const WorkspaceListPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(WorkspaceList);
const WorkspaceSearchAdminPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(AdminWorkspaceSearch);

export const SignedInRoutes = () => {
  return (
    <Switch>
      <AppRoute exact path='/' guards={[getAccessModuleGuard()]}>
        <HomepagePage routeData={{ title: 'Homepage' }} />
      </AppRoute>
      <AppRoute exact path={ACCESS_RENEWAL_PATH}>
        <AccessRenewalPage routeData={{ title: 'Access Renewal' }} />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/banner'
        guards={[authorityGuard(AuthorityGuardedAction.SERVICE_BANNER)]}
      >
        <AdminBannerPage
          routeData={{ title: 'Create Banner', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/egress-events'
        guards={[authorityGuard(AuthorityGuardedAction.EGRESS_EVENTS)]}
      >
        <AdminEgressEventsPage
          routeData={{ title: 'Egress Events', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/egress-events/:eventId'
        guards={[authorityGuard(AuthorityGuardedAction.EGRESS_EVENTS)]}
      >
        <AdminEgressAuditPage
          routeData={{ title: 'Egress Event Audit', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/institution'
        guards={[authorityGuard(AuthorityGuardedAction.INSTITUTION_ADMIN)]}
      >
        <InstitutionAdminPage
          routeData={{ title: 'Institution Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/institution/add'
        guards={[authorityGuard(AuthorityGuardedAction.INSTITUTION_ADMIN)]}
      >
        <InstitutionEditAdminPage
          routeData={{ title: 'Institution Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/institution/edit/:institutionId'
        guards={[authorityGuard(AuthorityGuardedAction.INSTITUTION_ADMIN)]}
      >
        <InstitutionEditAdminPage
          routeData={{ title: 'Institution Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute exact path='/admin/user'>
        {' '}
        {/* included for backwards compatibility */}
        <Redirect to={'/admin/users'} />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/users'
        guards={[authorityGuard(AuthorityGuardedAction.USER_ADMIN)]}
      >
        <UsersAdminPage
          routeData={{ title: 'User Admin Table', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/users-deprecated/:usernameWithoutGsuiteDomain'
        guards={[authorityGuard(AuthorityGuardedAction.USER_ADMIN)]}
      >
        <UserAdminPage
          routeData={{ title: 'User Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/users/:usernameWithoutGsuiteDomain'
        guards={[authorityGuard(AuthorityGuardedAction.USER_ADMIN)]}
      >
        <UserAdminProfilePage
          routeData={{ title: 'User Profile Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/user-audit'
        guards={[authorityGuard(AuthorityGuardedAction.USER_AUDIT)]}
      >
        <UserAuditPage
          routeData={{ title: 'User Audit', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/bulk-sync-user-access'
        guards={[authorityGuard(AuthorityGuardedAction.USER_AUDIT)]}
      >
        <UserAccessPage
          routeData={{ title: 'Bulk Sync User Access', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/user-audit/:username'
        guards={[authorityGuard(AuthorityGuardedAction.USER_AUDIT)]}
      >
        <UserAuditPage
          routeData={{ title: 'User Audit', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/workspaces'
        guards={[authorityGuard(AuthorityGuardedAction.WORKSPACE_ADMIN)]}
      >
        <WorkspaceSearchAdminPage
          routeData={{ title: 'Workspace Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/workspaces/:ns'
        guards={[authorityGuard(AuthorityGuardedAction.WORKSPACE_ADMIN)]}
      >
        <WorkspaceAdminPage
          routeData={{ title: 'Workspace Admin', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/workspace-audit'
        guards={[authorityGuard(AuthorityGuardedAction.WORKSPACE_AUDIT)]}
      >
        <WorkspaceAuditPage
          routeData={{ title: 'Workspace Audit', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/workspace-audit/:ns'
        guards={[authorityGuard(AuthorityGuardedAction.WORKSPACE_AUDIT)]}
      >
        <WorkspaceAuditPage
          routeData={{ title: 'Workspace Audit', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/admin/workspaces/:ns/:nbName'
        guards={[authorityGuard(AuthorityGuardedAction.WORKSPACE_ADMIN)]}
      >
        <AdminNotebookViewPage
          routeData={{ pathElementForTitle: 'nbName', minimizeChrome: true }}
        />
      </AppRoute>
      <AppRoute exact path={DATA_ACCESS_REQUIREMENTS_PATH}>
        <DataAccessRequirementsPage
          routeData={{ title: 'Data Access Requirements' }}
        />
      </AppRoute>
      <AppRoute exact path='/data-code-of-conduct'>
        <DataUserCodeOfConductPage
          routeData={{
            title: 'Data User Code of Conduct',
            minimizeChrome: true,
          }}
        />
      </AppRoute>
      <AppRoute exact path='/profile'>
        <ProfilePage routeData={{ title: 'Profile' }} />
      </AppRoute>
      <AppRoute exact path={NIH_CALLBACK_PATH}>
        <DataAccessRequirementsPage
          routeData={{ title: 'Data Access Requirements' }}
        />
      </AppRoute>
      <AppRoute exact path={RAS_CALLBACK_PATH}>
        <DataAccessRequirementsPage
          routeData={{ title: 'Data Access Requirements' }}
        />
      </AppRoute>
      <AppRoute exact path='/library' guards={[getAccessModuleGuard()]}>
        <WorkspaceLibraryPage
          routeData={{ title: 'Workspace Library', minimizeChrome: false }}
        />
      </AppRoute>
      <AppRoute exact path='/workspaces' guards={[getAccessModuleGuard()]}>
        <WorkspaceListPage
          routeData={{
            title: 'View Workspaces',
            breadcrumb: BreadcrumbType.Workspaces,
          }}
        />
      </AppRoute>
      <AppRoute
        exact
        path='/workspaces/build'
        guards={[getAccessModuleGuard()]}
      >
        <WorkspaceEditPage
          routeData={{ title: 'Create Workspace' }}
          workspaceEditMode={WorkspaceEditMode.Create}
        />
      </AppRoute>
      <AppRoute
        path='/workspaces/:ns/:wsid'
        exact={false}
        guards={[getAccessModuleGuard()]}
      >
        <WorkspaceWrapperPage intermediaryRoute={true} routeData={{}} />
      </AppRoute>
      <AppRoute exact path='*'>
        <Redirect to={'/not-found'} />
      </AppRoute>
    </Switch>
  );
};
