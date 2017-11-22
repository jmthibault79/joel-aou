import {DebugElement} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRoute, UrlSegment} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {ClarityModule} from 'clarity-angular';

import {ErrorHandlingService} from 'app/services/error-handling.service';
import {WorkspaceComponent} from 'app/views/workspace/component';
import {CohortsServiceStub} from 'testing/stubs/cohort-service-stub';
import {ErrorHandlingServiceStub} from 'testing/stubs/error-handling-service-stub';
import {WorkspacesServiceStub, WorkspaceStubVariables} from 'testing/stubs/workspace-service-stub';
import {updateAndTick} from 'testing/test-helpers';

import {ClusterService} from 'generated';
import {CohortsService} from 'generated';
import {WorkspacesService} from 'generated';

class WorkspacePage {
  fixture: ComponentFixture<WorkspaceComponent>;
  cohortsService: CohortsService;
  workspacesService: WorkspacesService;
  route: UrlSegment[];
  workspaceNamespace: string;
  workspaceId: string;
  cohortsTableRows: DebugElement[];
  notebookTableRows: DebugElement[];
  cdrText: DebugElement;
  workspaceDescription: DebugElement;
  loggedOutMessage: DebugElement;

  constructor(testBed: typeof TestBed) {
    this.fixture = testBed.createComponent(WorkspaceComponent);
    this.cohortsService = this.fixture.debugElement.injector.get(CohortsService);
    this.route = this.fixture.debugElement.injector.get(ActivatedRoute).snapshot.url;
    this.workspacesService = this.fixture.debugElement.injector.get(WorkspacesService);
    this.readPageData();
  }

  readPageData() {
    updateAndTick(this.fixture);
    updateAndTick(this.fixture);
    this.workspaceNamespace = this.route[1].path;
    this.workspaceId = this.route[2].path;
    this.cohortsTableRows = this.fixture.debugElement.queryAll(By.css('.cohort-table-row'));
    this.notebookTableRows = this.fixture.debugElement.queryAll(By.css('.notebook-table-row'));
    this.cdrText = this.fixture.debugElement.query(By.css('.cdr-text'));
    this.workspaceDescription = this.fixture.debugElement.query(By.css('.description-text'));
    this.loggedOutMessage = this.fixture.debugElement.query(By.css('.logged-out-message'));
  }
}

const activatedRouteStub  = {
  snapshot: {
    url: [
      {path: 'workspace'},
      {path: WorkspaceStubVariables.DEFAULT_WORKSPACE_NS},
      {path: WorkspaceStubVariables.DEFAULT_WORKSPACE_ID}
    ],
    params: {
      'ns': WorkspaceStubVariables.DEFAULT_WORKSPACE_NS,
      'wsid': WorkspaceStubVariables.DEFAULT_WORKSPACE_ID
    }
  }
};

describe('WorkspaceComponent', () => {
  let workspacePage: WorkspacePage;

  beforeEach(fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        ClarityModule.forRoot()
      ],
      declarations: [
        WorkspaceComponent
      ],
      providers: [
        { provide: ClusterService, useValue: ClusterService },
        { provide: CohortsService, useValue: new CohortsServiceStub() },
        { provide: ErrorHandlingService, useValue: new ErrorHandlingServiceStub() },
        { provide: WorkspacesService, useValue: new WorkspacesServiceStub() },
        { provide: ActivatedRoute, useValue: activatedRouteStub }
      ] }).compileComponents().then(() => {
        workspacePage = new WorkspacePage(TestBed);
      });
      tick();
  }));


  it('displays correct information in default workspace', fakeAsync(() => {
    let expectedCohorts: number;
    workspacePage.cohortsService.getCohortsInWorkspace(
        workspacePage.workspaceNamespace,
        workspacePage.workspaceId)
      .subscribe(cohorts => {
      expectedCohorts = cohorts.items.length;
    });
    tick();
    expect(workspacePage.cohortsTableRows.length).toEqual(expectedCohorts);
    expect(workspacePage.notebookTableRows.length).toEqual(0);
  }));

  it('fetches the correct workspace', fakeAsync(() => {
    workspacePage.fixture.componentRef.instance.ngOnInit();
    updateAndTick(workspacePage.fixture);
    updateAndTick(workspacePage.fixture);
    expect(workspacePage.cdrText.nativeElement.innerText)
      .toMatch(WorkspaceStubVariables.DEFAULT_WORKSPACE_CDR_VERSION);
    expect(workspacePage.workspaceDescription.nativeElement.innerText)
      .toMatch(WorkspaceStubVariables.DEFAULT_WORKSPACE_DESCRIPTION);
  }));



});
