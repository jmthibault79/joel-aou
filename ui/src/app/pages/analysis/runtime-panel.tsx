import {Button, Clickable, MenuItem} from 'app/components/buttons';
import {FlexColumn, FlexRow} from 'app/components/flex';
import {ClrIcon} from 'app/components/icons';
import {PopupTrigger} from 'app/components/popups';
import {Spinner} from 'app/components/spinners';
import colors, {addOpacity} from 'app/styles/colors';
import {reactStyles, withCurrentWorkspace} from 'app/utils';
import {allMachineTypes, validLeonardoMachineTypes} from 'app/utils/machines';
import {useCustomRuntime} from 'app/utils/runtime-utils';
import {
  RuntimeOperation,
  runtimeOpsStore,
  useStore
} from 'app/utils/stores';
import {WorkspaceData} from 'app/utils/workspace-data';
import {Dropdown} from 'primereact/dropdown';
import {InputNumber} from 'primereact/inputnumber';

import { RuntimeStatus } from 'generated';
import * as fp from 'lodash/fp';
import * as React from 'react';

const {useState, Fragment} = React;

const styles = reactStyles({
  sectionHeader: {
    color: colors.primary,
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: '1rem',
    marginBottom: '12px',
    marginTop: '12px'
  },
  controlSection: {
    backgroundColor: String(addOpacity(colors.white, .75)),
    borderRadius: '3px',
    padding: '.75rem',
    marginTop: '.75rem'
  },
  presetMenuItem: {
    color: colors.primary,
    fontSize: '14px'
  }
});

const defaultMachineType = allMachineTypes.find(({name}) => name === 'n1-standard-4');

export interface Props {
  workspace: WorkspaceData;
}

const MachineSelector = ({onChange, updatedMachine, masterMachineType}) => {
  const initialMachineType = fp.find(({name}) => name === masterMachineType, allMachineTypes) || defaultMachineType;
  const {cpu, memory} = updatedMachine || initialMachineType;
  const maybeGetMachine = machineRequested => fp.equals(machineRequested, initialMachineType) ? null : machineRequested;

  return <Fragment>
    <div>
      <label htmlFor='runtime-cpu'
            style={{marginRight: '.25rem'}}>CPUs</label>
      <Dropdown id='runtime-cpu'
                options={fp.flow(
                  // Show all CPU options.
                  fp.map('cpu'),
                  // In the event that was remove a machine type from our set of valid
                  // configs, we want to continue to allow rendering of the value here.
                  // Union also makes the CPU values unique.
                  fp.union([cpu]),
                  fp.sortBy(fp.identity)
                )(validLeonardoMachineTypes)}
                onChange={
                  ({value}) => fp.flow(
                    fp.sortBy('memory'),
                    fp.find({cpu: value}),
                    maybeGetMachine,
                    onChange)(validLeonardoMachineTypes)
                }
                value={cpu}/>
    </div>
    <div>
      <label htmlFor='runtime-ram'
            style={{marginRight: '.25rem'}}>RAM (GB)</label>
      <Dropdown id='runtime-ram'
                options={fp.flow(
                  // Show valid memory options as constrained by the currently selected CPU.
                  fp.filter(({cpu: availableCpu}) => availableCpu === cpu),
                  fp.map('memory'),
                  // See above comment on CPU union.
                  fp.union([memory]),
                  fp.sortBy(fp.identity)
                )(validLeonardoMachineTypes)}
                onChange={
                  ({value}) => fp.flow(
                    fp.find({cpu, memory: value}),
                    // If the selected machine is not different from the current machine return null
                    maybeGetMachine,
                    onChange
                    )(validLeonardoMachineTypes) }
                value={memory}
                />
    </div>
  </Fragment>;
};

const DiskSizeSelection = ({onChange, updatedDiskSize, masterDiskSize}) => {
  return <div>
    <label htmlFor='runtime-disk'
          style={{marginRight: '.25rem'}}>Disk (GB)</label>
      <InputNumber id='runtime-disk'
                showButtons
                decrementButtonClassName='p-button-secondary'
                incrementButtonClassName='p-button-secondary'
                value={updatedDiskSize || masterDiskSize}
                inputStyle={{padding: '.75rem .5rem', width: '2rem'}}
                onChange={({value}) => onChange(value === masterDiskSize ? null : value)}
                min={50 /* Runtime API has a minimum 50GB requirement. */}/>
  </div>;
};

export const RuntimePanel = withCurrentWorkspace()(({workspace}) => {
  const [updatedDiskSize, setUpdatedDiskSize] = useState(null);
  const [updatedMachine, setUpdatedMachine] = useState(null);
  const runtimeOps = useStore(runtimeOpsStore);
  const [currentRuntime, setRequestedRuntime] = useCustomRuntime(workspace.namespace);

  const activeRuntimeOp: RuntimeOperation = runtimeOps.opsByWorkspaceNamespace[workspace.namespace];
  const {status = RuntimeStatus.Unknown, toolDockerImage = '', dataprocConfig = null, gceConfig = {}} = currentRuntime || {};
  const masterMachineType = !!dataprocConfig ? dataprocConfig.masterMachineType : gceConfig.machineType;
  const masterDiskSize = !!dataprocConfig ? dataprocConfig.masterDiskSize : gceConfig.bootDiskSize;
  const updatedMachineType = updatedMachine && updatedMachine.name;

  const isDataproc = (currentRuntime && !!currentRuntime.dataprocConfig);
  const runtimeChanged = updatedMachine || updatedDiskSize;

  if (currentRuntime === undefined) {
    return <Spinner style={{width: '100%', marginTop: '5rem'}}/>;
  } else if (currentRuntime === null) {
    // TODO(RW-5591): Create runtime page goes here.
    return <React.Fragment>
      <div>No runtime exists yet</div>
      {activeRuntimeOp && <hr/>}
      {activeRuntimeOp && <div>
      </div>}
    </React.Fragment>;
  }

  return <div data-test-id='runtime-panel'>
    <h3 style={styles.sectionHeader}>Cloud analysis environment</h3>
    <div>
      Your analysis environment consists of an application and compute resources.
      Your cloud environment is unique to this workspace and not shared with other users.
    </div>
    {/* TODO(RW-5419): Cost estimates go here. */}
    <div style={styles.controlSection}>
      {/* Recommended runtime: pick from default templates or change the image. */}
      <PopupTrigger side='bottom'
                    closeOnClick
                    content={
                      <React.Fragment>
                        <MenuItem style={styles.presetMenuItem}>General purpose analysis</MenuItem>
                        <MenuItem style={styles.presetMenuItem}>Genomics analysis</MenuItem>
                      </React.Fragment>
                    }>
        <Clickable data-test-id='runtime-presets-menu'
                   disabled={true}>
          Recommended environments <ClrIcon shape='caret down'/>
        </Clickable>
      </PopupTrigger>
      <h3 style={styles.sectionHeader}>Application configuration</h3>
      {/* TODO(RW-5413): Populate the image list with server driven options. */}
      <Dropdown style={{width: '100%'}}
                data-test-id='runtime-image-dropdown'
                disabled={true}
                options={[toolDockerImage]}
                value={toolDockerImage}/>
      {/* Runtime customization: change detailed machine configuration options. */}
      <h3 style={styles.sectionHeader}>Cloud compute profile</h3>
      <FlexRow style={{justifyContent: 'space-between'}}>
        <MachineSelector updatedMachine={updatedMachine} onChange={setUpdatedMachine} masterMachineType={masterMachineType}/>
        <DiskSizeSelection updatedDiskSize={updatedDiskSize} onChange={setUpdatedDiskSize} masterDiskSize={masterDiskSize}/>
      </FlexRow>
      <FlexColumn style={{marginTop: '1rem'}}>
        <label htmlFor='runtime-compute'>Compute type</label>
        <Dropdown id='runtime-compute'
                  style={{width: '10rem'}}
                  disabled={true}
                  options={['Dataproc cluster', 'Standard VM']}
                  value={isDataproc ? 'Dataproc cluster' : 'Standard VM'}/>
      </FlexColumn>
    </div>
    <FlexRow style={{justifyContent: 'flex-end', marginTop: '.75rem'}}>
      <Button
        aria-label={currentRuntime ? 'Update' : 'Create'}
        disabled={status !== RuntimeStatus.Running || !runtimeChanged}
        onClick={() =>
          setRequestedRuntime({gceConfig: {
            machineType: updatedMachineType || masterMachineType,
            diskSize: updatedDiskSize || masterDiskSize
          }})
        }
      >{currentRuntime ? 'Update' : 'Create'}</Button>
    </FlexRow>
  </div>;

});
