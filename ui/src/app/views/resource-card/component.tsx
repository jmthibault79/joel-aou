import {Component, Input} from '@angular/core';
import * as fp from 'lodash/fp';
import * as React from 'react';

import {Button, Clickable, MenuItem} from 'app/components/buttons';
import {Card} from 'app/components/card';
import {ClrIcon} from 'app/components/icons';
import {Modal, ModalBody, ModalFooter, ModalTitle} from 'app/components/modals';
import {PopupTrigger} from 'app/components/popups';
import {reactStyles, ReactWrapperBase, switchCase} from 'app/utils';
import {navigate, navigateByUrl} from 'app/utils/navigation';
import {ResourceType} from 'app/utils/resourceActions';

import {ConfirmDeleteModal} from 'app/views/confirm-delete-modal/component';
import {EditModal} from 'app/views/edit-modal/component';
import {RenameModal} from 'app/views/rename-modal/component';
import {Domain, RecentResource} from 'generated/fetch';

import {cohortsApi, conceptSetsApi, workspacesApi} from 'app/services/swagger-fetch-clients';
import {environment} from 'environments/environment';

const ResourceCardMenu: React.FunctionComponent<{
  disabled: boolean, resourceType: ResourceType, onRenameNotebook: Function,
  onOpenJupyterLabNotebook: any, onCloneResource: Function, onDeleteResource: Function,
  onEditCohort: Function, onReviewCohort: Function, onEditConceptSet: Function
}> = ({
  disabled, resourceType, onRenameNotebook, onOpenJupyterLabNotebook, onCloneResource,
  onDeleteResource, onEditCohort, onReviewCohort, onEditConceptSet
}) => {
  return <PopupTrigger
    data-test-id='resource-card-menu'
    side='bottom'
    closeOnClick
    content={
      switchCase(resourceType,
        ['notebook', () => {
          return <React.Fragment>
            <MenuItem icon='pencil' onClick={onRenameNotebook}>Rename</MenuItem>
            <MenuItem icon='copy' onClick={onCloneResource}>Duplicate</MenuItem>
            <MenuItem icon='trash' onClick={onDeleteResource}>Delete</MenuItem>
            {
              environment.enableJupyterLab &&
              /*
               This does not support both playground mode and jupyterLab yet,
               that is a work in progress. We do not need to worry about that
               here, because the menu will not open if you do not have write
               access, and playground mode is currently only enabled if you do
               not have write access.
              */
              <MenuItem icon='grid-view' onClick={onOpenJupyterLabNotebook}>
                Open in Jupyter Lab
              </MenuItem>
            }
          </React.Fragment>;
        }],
        ['cohort', () => {
          return <React.Fragment>
            <MenuItem icon='copy' onClick={onCloneResource}>Duplicate</MenuItem>
            <MenuItem icon='pencil' onClick={onEditCohort}>Edit</MenuItem>
            <MenuItem icon='grid-view' onClick={onReviewCohort}>Review</MenuItem>
            <MenuItem icon='trash' onClick={onDeleteResource}>Delete</MenuItem>
          </React.Fragment>;
        }],
        ['conceptSet', () => {
          return <React.Fragment>
            <MenuItem icon='pencil' onClick={onEditConceptSet}>Edit</MenuItem>
            <MenuItem icon='trash' onClick={onDeleteResource}>Delete</MenuItem>
          </React.Fragment>;
        }]
      )
    }
  >
    <Clickable disabled={disabled} data-test-id='resource-menu'>
      <ClrIcon shape='ellipsis-vertical' size={21}
               style={{color: disabled ? '#9B9B9B' : '#2691D0', marginLeft: -9,
                 cursor: disabled ? 'auto' : 'pointer'}}/>
    </Clickable>
  </PopupTrigger>;
};

@Component({
  selector: 'app-resource-card-menu',
  template: '<div #root></div>'
})
export class ResourceCardMenuComponent extends ReactWrapperBase {
  @Input() disabled;
  @Input() resourceType;
  @Input() onRenameNotebook;
  @Input() onOpenJupyterLabNotebook;
  @Input() onCloneResource;
  @Input() onDeleteResource;
  @Input() onEditCohort;
  @Input() onReviewCohort;
  @Input() onEditConceptSet;

  constructor() {
    super(ResourceCardMenu, [
      'disabled', 'resourceType', 'onRenameNotebook', 'onOpenJupyterLabNotebook',
      'onCloneResource', 'onDeleteResource', 'onEditCohort', 'onReviewCohort',
      'onEditConceptSet'
    ]);
  }
}

const styles = reactStyles({
  card: {
    marginTop: '1rem',
    justifyContent: 'space-between',
    width: '200px',
    height: '223px',
    marginRight: '1rem',
    padding: '0.75rem 0.75rem 0rem 0.75rem',
    boxShadow: '0 0 0 0'
  },
  cardName: {
    fontSize: '18px',
    fontWeight: 500,
    lineHeight: '22px',
    color: '#2691D0',
    cursor: 'pointer',
    wordBreak: 'break-all'
  },
  lastModified: {
    color: '#4A4A4A',
    fontSize: '11px',
    display: 'inline-block',
    lineHeight: '14px',
    fontWeight: 300,
    marginBottom: '0.2rem'
  },
  resourceType: {
    height: '22px',
    width: 'max-content',
    paddingLeft: '10px',
    paddingRight: '10px',
    borderRadius: '4px 4px 0 0',
    display: 'flex',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: '12px',
    fontWeight: 500
  },
  cardFooter: {
    display: 'flex',
    flexDirection: 'column'
  }
});

const resourceTypeStyles = reactStyles({
  cohort: {
    backgroundColor: '#F8C954'
  },
  conceptSet: {
    backgroundColor: '#AB87B3'
  },
  notebook: {
    backgroundColor: '#8BC990'
  }
});

export interface ResourceCardProps {
  resourceCard: RecentResource;
  onUpdate: Function;
}

export interface ResourceCardState {
  renaming: boolean;
  editing: boolean;
  confirmDeleting: boolean;
  invalidResourceError: boolean;
}

export class ResourceCard extends React.Component<ResourceCardProps, ResourceCardState> {

  constructor(props: ResourceCardProps) {
    super(props);
    this.state = {
      editing: false,
      renaming: false,
      confirmDeleting: false,
      invalidResourceError: !(props.resourceCard.notebook ||
          props.resourceCard.cohort ||
          props.resourceCard.conceptSet)
    };
  }

  // TODO [1/31/19] This method is only necessary until the parent components
  //    (notebook-list, cohort-list, conceptSet-list) have been converted and use the
  //    fetch API models.
  static castConceptSet(resourceCard: RecentResource): RecentResource {
    if (resourceCard.conceptSet) {
      const myTempConceptSet = {...resourceCard.conceptSet,
        domain: resourceCard.conceptSet.domain as Domain};
      return {...resourceCard, conceptSet: myTempConceptSet};
    }
    return resourceCard;
  }

  get resourceType(): ResourceType {
    if (this.props.resourceCard.notebook) {
      return ResourceType.NOTEBOOK;
    } else if (this.props.resourceCard.cohort) {
      return ResourceType.COHORT;
    } else if (this.props.resourceCard.conceptSet) {
      return ResourceType.CONCEPT_SET;
    } else {
      return ResourceType.INVALID;
    }
  }

  get isCohort(): boolean {
    return this.resourceType === ResourceType.COHORT;
  }

  get isConceptSet(): boolean {
    return this.resourceType === ResourceType.CONCEPT_SET;
  }

  get isNotebook(): boolean {
    return this.resourceType === ResourceType.NOTEBOOK;
  }

  get actionsDisabled(): boolean {
    return !this.writePermission;
  }

  get writePermission(): boolean {
    return this.props.resourceCard.permission === 'OWNER'
        || this.props.resourceCard.permission === 'WRITER';
  }

  get notebookReadOnly(): boolean {
    return this.isNotebook
        && this.props.resourceCard.permission === 'READER';
  }

  get displayName(): string {
    if (this.isNotebook) {
      return this.props.resourceCard.notebook.name.replace(/\.ipynb$/, '');
    } else if (this.isCohort) {
      return this.props.resourceCard.cohort.name;
    } else if (this.isConceptSet) {
      return this.props.resourceCard.conceptSet.name;
    }
  }

  get displayDate(): string {
    const date = new Date(Number(this.props.resourceCard.modifiedTime));
    // datetime formatting to slice off weekday from readable date string
    return date.toDateString().split(' ').slice(1).join(' ');
  }

  get description(): string {
    if (this.isCohort) {
      return this.props.resourceCard.cohort.description;
    } else if (this.isConceptSet) {
      return this.props.resourceCard.conceptSet.description;
    }
  }

  edit(): void {
    this.setState({editing: true});
  }

  reviewCohort(): void {
    const {resourceCard: {workspaceNamespace, workspaceFirecloudName, cohort: {id}}} = this.props;
    navigateByUrl(
      `/workspaces/${workspaceNamespace}/${workspaceFirecloudName}/cohorts/${id}/review`);
  }

  closeEditModal(): void {
    this.setState({editing: false});
  }

  renameNotebook(): void {
    this.setState({renaming: true});
  }

  cancelRename(): void {
    this.setState({renaming: false});
  }

  openConfirmDelete(): void {
    this.setState({confirmDeleting: true});
  }

  closeConfirmDelete(): void {
    this.setState({confirmDeleting: false});
  }

  cloneResource(): void {
    switch (this.resourceType) {
      case ResourceType.NOTEBOOK: {
        workspacesApi().cloneNotebook(
          this.props.resourceCard.workspaceNamespace,
          this.props.resourceCard.workspaceFirecloudName,
          this.props.resourceCard.notebook.name)
          .then(() => {
            this.props.onUpdate();
          });
        break;
      }
      case ResourceType.COHORT: {
        const url =
            '/workspaces/' + this.props.resourceCard.workspaceNamespace + '/' +
            this.props.resourceCard.workspaceFirecloudName + '/cohorts/build?cohortId=';
        navigateByUrl(url + this.props.resourceCard.cohort.id);
        this.props.onUpdate();
        break;
      }
    }
  }

  receiveDelete(): void {
    switch (this.resourceType) {
      case ResourceType.NOTEBOOK: {
        workspacesApi().deleteNotebook(
          this.props.resourceCard.workspaceNamespace,
          this.props.resourceCard.workspaceFirecloudName,
          this.props.resourceCard.notebook.name)
          .then(() => {
            this.closeConfirmDelete();
            this.props.onUpdate();
          });
        break;
      }
      case ResourceType.COHORT: {
        cohortsApi().deleteCohort(
          this.props.resourceCard.workspaceNamespace,
          this.props.resourceCard.workspaceFirecloudName,
          this.props.resourceCard.cohort.id)
          .then(() => {
            this.closeConfirmDelete();
            this.props.onUpdate();
          });
        break;
      }
      case ResourceType.CONCEPT_SET: {
        conceptSetsApi().deleteConceptSet(
          this.props.resourceCard.workspaceNamespace,
          this.props.resourceCard.workspaceFirecloudName,
          this.props.resourceCard.conceptSet.id)
          .then(() => {
            this.closeConfirmDelete();
            this.props.onUpdate();
          });
      }
    }
  }

  receiveEdit(resource: RecentResource): void {
    if (this.isCohort) {
      cohortsApi().updateCohort(
        this.props.resourceCard.workspaceNamespace,
        this.props.resourceCard.workspaceFirecloudName,
        this.props.resourceCard.cohort.id,
        resource.cohort
      ).then( () => {
        this.closeEditModal();
        this.props.onUpdate();
      });
    } else if (this.isConceptSet) {
      conceptSetsApi().updateConceptSet(
        this.props.resourceCard.workspaceNamespace,
        this.props.resourceCard.workspaceFirecloudName,
        this.props.resourceCard.conceptSet.id,
        ResourceCard.castConceptSet(resource).conceptSet
      ).then( () => {
        this.closeEditModal();
        this.props.onUpdate();
      });
    }
  }

  receiveNotebookRename(): void {
    this.setState({renaming: false});
    this.props.onUpdate();
  }

  openResource(jupyterLab?: boolean): void {
    switch (this.resourceType) {
      case ResourceType.COHORT: {
        this.reviewCohort();
        break;
      }
      case ResourceType.CONCEPT_SET: {
        navigate(['workspaces', this.props.resourceCard.workspaceNamespace,
          this.props.resourceCard.workspaceFirecloudName, 'concepts', 'sets',
          this.props.resourceCard.conceptSet.id], {relativeTo: null});
        break;
      }
      case ResourceType.NOTEBOOK: {
        const queryParams = {
          playgroundMode: false,
          jupyterLabMode: jupyterLab
        };
        if (this.notebookReadOnly) {
          queryParams.playgroundMode = true;
        }
        navigate(
          ['workspaces', this.props.resourceCard.workspaceNamespace,
            this.props.resourceCard.workspaceFirecloudName, 'notebooks',
            encodeURIComponent(this.props.resourceCard.notebook.name)], {
              queryParams,
              relativeTo: null,
            });
      }
    }
  }

  render() {
    return <React.Fragment>
      {this.state.invalidResourceError &&
      <Modal>
        <ModalTitle>Invalid Resource Type</ModalTitle>
        <ModalBody>Please Report a Bug.</ModalBody>
        <ModalFooter>
          <Button onClick={() => this.setState({invalidResourceError: false})}>OK</Button>
        </ModalFooter>
      </Modal>}
      <Card style={styles.card}
            data-test-id='card'>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start'}}>
            <ResourceCardMenu disabled={this.actionsDisabled}
                              resourceType={this.resourceType}
                              onCloneResource={() => this.cloneResource()}
                              onDeleteResource={() => this.openConfirmDelete()}
                              onRenameNotebook={() => this.renameNotebook()}
                              onEditCohort={() => this.edit()}
                              onEditConceptSet={() => this.edit()}
                              onReviewCohort={() => this.reviewCohort()}
                              onOpenJupyterLabNotebook={() => this.openResource(true)}/>
            <Clickable disabled={this.actionsDisabled && !this.notebookReadOnly}>
              <div style={styles.cardName}
                   data-test-id='card-name'
                   onClick={() => this.openResource()}>{this.displayName}
              </div>
            </Clickable>
          </div>
          <div>{this.description}</div>
        </div>
        <div style={styles.cardFooter}>
          <div style={styles.lastModified}>
            Last Modified: {this.displayDate}</div>
          <div style={{...styles.resourceType, ...resourceTypeStyles[this.resourceType]}}
               data-test-id='card-type'>
            {fp.startCase(fp.camelCase(this.resourceType.toString()))}</div>
        </div>
      </Card>
      {this.state.editing && (this.isCohort  || this.isConceptSet) &&
        <EditModal resource={ResourceCard.castConceptSet(this.props.resourceCard)}
                   onEdit={v => this.receiveEdit(v)}
                   onCancel={() => this.closeEditModal()}/>}
      {this.state.renaming && this.isNotebook &&
        <RenameModal notebookName={this.props.resourceCard.notebook.name}
                     workspace={{
                       namespace: this.props.resourceCard.workspaceNamespace,
                       name: this.props.resourceCard.workspaceFirecloudName
                     }}
                     onRename={() => this.receiveNotebookRename()}
                     onCancel={() => this.cancelRename()}/>}
      {this.state.confirmDeleting &&
        <ConfirmDeleteModal resourceName={this.displayName}
                            resourceType={this.resourceType}
                            receiveDelete={() => this.receiveDelete()}
                            closeFunction={() => this.closeConfirmDelete()}/>}
    </React.Fragment>;
  }
}

@Component ({
  selector : 'app-resource-card',
  template: '<div #root></div>'
})
export class ResourceCardComponent extends ReactWrapperBase {
  resourceType: ResourceType;
  @Input('resourceCard') resourceCard: ResourceCardProps['resourceCard'];
  @Input('onUpdate') onUpdate: ResourceCardProps['onUpdate'];

  constructor() {
    super(ResourceCard, ['resourceCard', 'onUpdate']);
  }
}
