import {DebugElement} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {By} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, UrlSegment} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {ClarityModule} from '@clr/angular';

import {IconsModule} from 'app/icons/icons.module';
import {ProfileStorageService} from 'app/services/profile-storage.service';
import {SignInService} from 'app/services/sign-in.service';
import {BugReportComponent} from 'app/views/bug-report/component';
import {ConfirmDeleteModalComponent} from 'app/views/confirm-delete-modal/component';
import {NewNotebookModalComponent} from 'app/views/new-notebook-modal/component';
import {NotebookListComponent} from 'app/views/notebook-list/component';
import {ResourceCardComponent, ResourceCardMenuComponent} from 'app/views/resource-card/component';
import {ToolTipComponent} from 'app/views/tooltip/component';
import {TopBoxComponent} from 'app/views/top-box/component';
import {WorkspaceNavBarComponent} from 'app/views/workspace-nav-bar/component';
import {WorkspaceShareComponent} from 'app/views/workspace-share/component';
import {WorkspaceWrapperComponent} from 'app/views/workspace-wrapper/component';


import {
  BugReportService,
  CohortsService,
  ConceptSetsService,
  ProfileService,
  UserMetricsService,
  WorkspaceAccessLevel,
  WorkspacesService
} from 'generated';

import {BugReportServiceStub} from 'testing/stubs/bug-report-service-stub';
import {ProfileServiceStub} from 'testing/stubs/profile-service-stub';
import {ProfileStorageServiceStub} from 'testing/stubs/profile-storage-service-stub';
import {UserMetricsServiceStub} from 'testing/stubs/user-metrics-service-stub';
import {WorkspacesServiceStub, WorkspaceStubVariables} from 'testing/stubs/workspace-service-stub';

import {registerApiClient} from 'app/services/swagger-fetch-clients';
import {WorkspacesApi} from 'generated/fetch';
import {WorkspacesApiStub} from 'testing/stubs/workspaces-api-stub';

import {
  findElementsReact,
  setupModals,
  simulateClickReact,
  updateAndTick
} from 'testing/test-helpers';


class NotebookListPage {
  fixture: ComponentFixture<NotebookListComponent>;
  workspacesService: WorkspacesService;
  route: UrlSegment[];
  workspaceNamespace: string;
  workspaceId: string;
  notebookCards: DebugElement[];
  addCard: DebugElement;

  constructor(testBed: typeof TestBed) {
    this.fixture = testBed.createComponent(NotebookListComponent);
    setupModals(this.fixture);
    registerApiClient(WorkspacesApi, new WorkspacesApiStub());
    this.route = this.fixture.debugElement.injector.get(ActivatedRoute).snapshot.url;
    this.workspacesService = this.fixture.debugElement.injector.get(WorkspacesService);
    this.readPageData();
  }

  readPageData() {
    updateAndTick(this.fixture);
    updateAndTick(this.fixture);
    this.workspaceNamespace = this.route[1].path;
    this.workspaceId = this.route[2].path;
    const de = this.fixture.debugElement;
    this.notebookCards = findElementsReact(this.fixture, '[data-test-id="card-name"]');
    this.addCard = de.queryAll((By.css('.add-card')))[0];
  }
}

const activatedRouteStub  = {
  snapshot: {
    url: [
      {path: 'workspaces'},
      {path: WorkspaceStubVariables.DEFAULT_WORKSPACE_NS},
      {path: WorkspaceStubVariables.DEFAULT_WORKSPACE_ID}
    ],
    params: {
      'ns': WorkspaceStubVariables.DEFAULT_WORKSPACE_NS,
      'wsid': WorkspaceStubVariables.DEFAULT_WORKSPACE_ID
    },
    data: {
      workspace: {
        ...WorkspacesServiceStub.stubWorkspace(),
        accessLevel: WorkspaceAccessLevel.OWNER,
      }
    }
  }
};

describe('NotebookListComponent', () => {
  let notebookListPage: NotebookListPage;
  beforeEach(fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        IconsModule,
        RouterTestingModule,
        ClarityModule.forRoot()
      ],
      declarations: [
        BugReportComponent,
        ConfirmDeleteModalComponent,
        NewNotebookModalComponent,
        NotebookListComponent,
        ResourceCardComponent,
        ResourceCardMenuComponent,
        ToolTipComponent,
        TopBoxComponent,
        WorkspaceNavBarComponent,
        WorkspaceWrapperComponent,
        WorkspaceShareComponent
      ],
      providers: [
        { provide: BugReportService, useValue: new BugReportServiceStub() },
        { provide: CohortsService },
        { provide: ConceptSetsService },
        { provide: SignInService, useValue: SignInService },
        { provide: ProfileStorageService, useValue: new ProfileStorageServiceStub() },
        { provide: ProfileService, useValue: new ProfileServiceStub() },
        { provide: UserMetricsService, useValue: new UserMetricsServiceStub()},
        { provide: WorkspacesService, useValue: new WorkspacesServiceStub() },
        { provide: ActivatedRoute, useValue: activatedRouteStub }
      ]}).compileComponents().then(() => {
        notebookListPage = new NotebookListPage(TestBed);
      });
    tick();
  }));


  it('displays correct information when notebooks selected.', fakeAsync(() => {
    notebookListPage.readPageData();
    tick();
    expect(notebookListPage.notebookCards.length).toEqual(1);
  }));

  it('displays correct notebook information', fakeAsync(() => {
    // Mock notebook service in workspace stub will be called as part of ngInit
    const fixture = notebookListPage.fixture;
    const app = fixture.debugElement.componentInstance;
    expect(app.notebookList.length).toEqual(1);
    expect(app.notebookList[0].name).toEqual('mockFile.ipynb');
    expect(app.notebookList[0].path).toEqual('gs://bucket/notebooks/mockFile.ipynb');
  }));

  it('displays correct information when notebook cloned', fakeAsync(() => {
    const fixture = notebookListPage.fixture;
    simulateClickReact(fixture, '[data-test-id="resource-menu"]');
    updateAndTick(fixture);
    simulateClickReact(fixture, '[data-test-id="copy"]');
    fixture.componentInstance.updateList();
    tick();
    updateAndTick(fixture);
    const notebooksOnPage = findElementsReact(fixture, '[data-test-id="card"]');
    expect(notebooksOnPage.map((nb) => nb.innerText)).toMatch('mockFile Clone');
    expect(fixture.componentInstance.resourceList.map(nb => nb.notebook.name))
      .toContain('mockFile Clone.ipynb');
  }));

  it('displays correct information when notebook deleted', fakeAsync(() => {
    const fixture = notebookListPage.fixture;
    simulateClickReact(fixture, '[data-test-id="resource-menu"]');
    simulateClickReact(fixture, '[data-test-id="trash"]');
    updateAndTick(fixture);
    simulateClickReact(fixture, '[data-test-id="confirm-delete"]');
    updateAndTick(fixture);
    const notebooksOnPage = findElementsReact(fixture, '[data-test-id="card"]');
    expect(notebooksOnPage.length).toBe(0);
  }));
});
