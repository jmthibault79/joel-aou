import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterEvent} from '@angular/router';
import * as fp from 'lodash/fp';

import {workspacesApi} from 'app/services/swagger-fetch-clients';
import {
  currentWorkspaceStore,
  navigate,
  nextWorkspaceWarmupStore,
  routeConfigDataStore,
  setSidebarActiveIconStore,
  urlParamsStore,
} from 'app/utils/navigation';

import {routeDataStore, runtimeStore} from 'app/utils/stores';

import {AnalyticsTracker} from 'app/utils/analytics';
import {ExceededActionCountError, LeoRuntimeInitializer} from 'app/utils/leo-runtime-initializer';
import {ResourceType, Workspace} from 'generated/fetch';

@Component({
  styleUrls: ['../../../styles/buttons.css',
    '../../../styles/headers.css'],
  templateUrl: './component.html',
})
export class WorkspaceWrapperComponent implements OnInit, OnDestroy {
  workspace: Workspace;
  deleting = false;
  workspaceDeletionError = false;
  tabPath: string;
  displayNavBar = true;
  confirmDeleting = false;
  menuDataLoading = false;
  resourceType: ResourceType = ResourceType.WORKSPACE;
  pageKey = 'data';
  pollAborter = new AbortController();
  // The iframe we use to display the Jupyter notebook does something strange
  // to the height calculation of the container, which is normally set to auto.
  // Setting this flag sets the container to 100% so that no content is clipped.
  contentFullHeightOverride = false;

  bugReportOpen: boolean;
  bugReportDescription = '';

  private subscriptions = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.openConfirmDelete = this.openConfirmDelete.bind(this);
    this.receiveDelete = this.receiveDelete.bind(this);
    this.closeConfirmDelete = this.closeConfirmDelete.bind(this);
    this.closeBugReport = this.closeBugReport.bind(this);
  }

  ngOnInit(): void {

    // ROUTER MIGRATION: This is allows the react-router conversion to utilize various route config properties
    // Once we are fully converted the help sidebar and modals will need to be reworked a bit to eliminate this Angular code
    this.subscriptions.push(routeDataStore.subscribe(
      ({minimizeChrome, pageKey, contentFullHeightOverride}) => {
        this.pageKey = pageKey;
        this.contentFullHeightOverride = contentFullHeightOverride;
        this.displayNavBar = !minimizeChrome;
      }
    ));

    this.tabPath = this.getTabPath();
    this.setPageKey();
    this.subscriptions.push(
      this.router.events.filter(event => event instanceof NavigationEnd)
        .subscribe((e: RouterEvent) => {
          this.tabPath = this.getTabPath();
          this.setPageKey();
          // Close sidebar on route change unless navigating between participants in cohort review
          // Bit of a hack to use regex to test if we're in the cohort review but the pageKey isn't being set at the
          // time when a user clicks onto a new participant so we can't use that to check if we're in the cohort review
          // We can probably clean this up after we fully migrate to React router
          if (!/\/data\/cohorts\/.*\/review\/participants\/.*/.test(e.url)) {
            setSidebarActiveIconStore.next(null);
          }
        }));
    this.subscriptions.push(routeConfigDataStore.subscribe((data) => {
      // ROUTER MIGRATION: Prevent dueling route configs during react transition - only apply minimizeChrome if there is route data
      if (!fp.isEqual(data, {})) {
        this.displayNavBar = !data.minimizeChrome;
      }
    }));
    this.subscriptions.push(urlParamsStore
      .map(({ns, wsid}) => ({ns, wsid}))
      .subscribe(({ns, wsid}) => {
        if (ns !== null && wsid !== null) {
          workspacesApi().updateRecentWorkspaces(ns, wsid);
        }
      }));
    this.subscriptions.push(urlParamsStore
      .map(({ns, wsid}) => ({ns, wsid}))
      .distinctUntilChanged(fp.isEqual)
      .switchMap(({ns, wsid}) => {
        // Clear the workspace/access level during the transition to ensure we
        // do not render the child component with a stale workspace.
        this.workspace = undefined;
        // This needs to happen for testing because we seed the urlParamsStore with {}.
        // Otherwise it tries to make an api call with undefined, because the component
        // initializes before we have access to the route.
        if (ns === undefined || wsid === undefined) {
          return Promise.resolve(null);
        }

        // In a handful of situations - namely on workspace creation/clone,
        // the application will preload the next workspace to avoid a redundant
        // refetch here.
        const nextWs = nextWorkspaceWarmupStore.getValue();
        nextWorkspaceWarmupStore.next(undefined);
        if (nextWs && nextWs.namespace === ns && nextWs.id === wsid) {
          return Promise.resolve(nextWs);
        }
        return workspacesApi().getWorkspace(ns, wsid).then((wsResponse) => {
          return {
            ...wsResponse.workspace,
            accessLevel: wsResponse.accessLevel
          };
        });
      })
      .subscribe(async(workspace) => {
        if (workspace === null) {
          // This handles the empty urlParamsStore story.
          return;
        }
        this.workspace = workspace;
        currentWorkspaceStore.next(workspace);
        runtimeStore.set({workspaceNamespace: workspace.namespace, runtime: undefined});
        this.pollAborter.abort();
        this.pollAborter = new AbortController();
        try {
          await LeoRuntimeInitializer.initialize({
            workspaceNamespace: workspace.namespace,
            pollAbortSignal: this.pollAborter.signal,
            maxCreateCount: 0,
            maxDeleteCount: 0,
            maxResumeCount: 0
          });
        } catch (e) {
          // Ignore ExceededActionCountError. This is thrown when the runtime doesn't exist, or
          // isn't started. Both of these scenarios are expected, since we don't want to do any lazy
          // initialization here.
          if (!(e instanceof ExceededActionCountError)) {
            throw e;
          }
        }
      })
    );
    this.subscriptions.push(currentWorkspaceStore.subscribe((workspace) => {
      if (workspace) {
        this.workspace = workspace;
      }
    }));
  }

  ngOnDestroy() {
    currentWorkspaceStore.next(undefined);
    for (const s of this.subscriptions) {
      s.unsubscribe();
    }
  }

  private getTabPath(): string {
    const child = this.route.firstChild;
    if (!child) {
      return '';
    }
    const path = child.routeConfig.path;
    if (!path.includes('/')) {
      return path;
    }
    return path.slice(0, path.indexOf('/'));
  }

  delete(workspace: Workspace): void {
    this.deleting = true;
    workspacesApi().deleteWorkspace(
      workspace.namespace, workspace.id).then(() => {
        navigate(['/workspaces']);
      }).catch(() => {
        this.workspaceDeletionError = true;
      });
  }

  receiveDelete(): void {
    AnalyticsTracker.Workspaces.Delete();
    this.delete(this.workspace);
  }

  openConfirmDelete(): void {
    this.confirmDeleting = true;
  }

  closeConfirmDelete(): void {
    this.confirmDeleting = false;
  }

  submitWorkspaceDeleteBugReport(): void {
    this.workspaceDeletionError = false;
    // this.bugReportComponent.reportBug();
    this.bugReportDescription = 'Could not delete workspace.';
    this.bugReportOpen = true;
  }

  closeBugReport(): void {
    this.bugReportOpen = false;
  }

  // This function does multiple things so we don't have to have two separate'
  // where loops on the route.
  setPageKey() {
    let child = this.route.firstChild;
    while (child) {
      if (child.snapshot.data.contentFullHeightOverride) {
        this.contentFullHeightOverride = true;
      }

      if (child.firstChild) {
        child = child.firstChild;
      } else {
        const {
          pageKey = null,
          contentFullHeightOverride = false
        } = child.snapshot.data || {};
        this.pageKey = pageKey;
        this.contentFullHeightOverride = contentFullHeightOverride;
        child = null;
      }
    }
  }
}
