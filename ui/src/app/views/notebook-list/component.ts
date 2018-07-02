import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Headers, Http, Response} from '@angular/http';
import {ActivatedRoute} from '@angular/router';


import {WorkspaceData} from 'app/resolvers/workspace';
import {SignInService} from 'app/services/sign-in.service';
import {BugReportComponent} from 'app/views/bug-report/component';
import {environment} from 'environments/environment';

import {
  Cluster,
  ClusterService,
  FileDetail,
  Workspace,
  WorkspaceAccessLevel,
  WorkspacesService
} from 'generated';

@Component({
  styleUrls: ['../../styles/buttons.css',
    '../../styles/cards.css',
    './component.css'],
  templateUrl: './component.html',
})
export class NotebookListComponent implements OnInit, OnDestroy {

  awaitingReview: boolean;
  notebooksLoading: boolean;
  notebookList: FileDetail[] = [];
  workspace: Workspace;
  notebookError: boolean;
  wsNamespace: string;
  wsId: string;
  localizeNotebooksError: boolean;
  cluster: Cluster;
  notebookAuthListeners: EventListenerOrEventListenerObject[] = [];
  private accessLevel: WorkspaceAccessLevel;


  @ViewChild(BugReportComponent)
  bugReportComponent: BugReportComponent;


  constructor(
    private route: ActivatedRoute,
    private signInService: SignInService,
    private workspacesService: WorkspacesService,
  ) {
    const wsData: WorkspaceData = this.route.snapshot.data.workspace;
    this.workspace = wsData;
    this.accessLevel = wsData.accessLevel;
    const {approved, reviewRequested} = this.workspace.researchPurpose;
    this.awaitingReview = reviewRequested && !approved;
  }

  ngOnInit(): void {
    this.wsNamespace = this.route.snapshot.params['ns'];
    this.wsId = this.route.snapshot.params['wsid'];
    this.notebooksLoading = true;
    this.loadNotebookList();
  }

  private loadNotebookList() {
    this.workspacesService.getNoteBookList(this.wsNamespace, this.wsId)
      .subscribe(
        fileList => {
          this.notebookList = fileList;
          this.notebooksLoading = false;
        },
        error => {
          this.notebooksLoading = false;
          this.notebookError = true;
        });
  }

  ngOnDestroy(): void {
    this.notebookAuthListeners.forEach(f => window.removeEventListener('message', f));
  }

  openNotebook(nb?: FileDetail): void {
    let nbUrl = `/workspaces/${this.workspace.namespace}/${this.workspace.id}/notebooks/`;
    if (nb) {
      nbUrl += encodeURIComponent(nb.name);
    } else {
      nbUrl += 'create';
    }
    const notebook = window.open(nbUrl, '_blank');

    // TODO(RW-474): Remove the authHandler integration. This is messy,
    // non-standard, and currently will break in the following situation:
    // - User opens a new notebook tab.
    // - While that tab is loading, user immediately navigates away from this
    //   page.
    // This is not easily fixed without leaking listeners outside the lifespan
    // of the workspace component.
    const authHandler = (e: MessageEvent) => {
      if (e.source !== notebook) {
        return;
      }
      if (e.origin !== environment.leoApiUrl) {
        return;
      }
      if (e.data.type !== 'bootstrap-auth.request') {
        return;
      }
      notebook.postMessage({
        'type': 'bootstrap-auth.response',
        'body': {
          'googleClientId': this.signInService.clientId
        }
      }, environment.leoApiUrl);
    };
    window.addEventListener('message', authHandler);
    this.notebookAuthListeners.push(authHandler);
  }

  newNotebook(): void {
    this.openNotebook();
  }

  get writePermission(): boolean {
    return this.accessLevel === WorkspaceAccessLevel.OWNER
      || this.accessLevel === WorkspaceAccessLevel.WRITER;
  }

  get ownerPermission(): boolean {
    return this.accessLevel === WorkspaceAccessLevel.OWNER;
  }

  get createDisabled(): boolean {
    return this.awaitingReview || !this.writePermission;
  }

  submitNotebooksLoadBugReport(): void {
    this.notebookError = false;
    this.bugReportComponent.reportBug();
    this.bugReportComponent.bugReport.shortDescription = 'Could not load notebooks';
  }

  submitNotebookLocalizeBugReport(): void {
    this.localizeNotebooksError = false;
    this.bugReportComponent.reportBug();
    this.bugReportComponent.bugReport.shortDescription = 'Could not localize notebook.';
  }
}
