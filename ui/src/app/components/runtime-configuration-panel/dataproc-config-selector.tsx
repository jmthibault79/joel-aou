import * as React from 'react';
import { InputNumber } from 'primereact/inputnumber';

import { RuntimeStatus } from 'generated/fetch';

import { FlexRow } from 'app/components/flex';
import { InfoIcon } from 'app/components/icons';
import { TooltipTrigger } from 'app/components/popups';
import { MachineSelector } from 'app/components/runtime-configuration-panel/machine-selector';
import { styles } from 'app/components/runtime-configuration-panel/styles';
import {
  DATAPROC_MIN_DISK_SIZE_GB,
  DEFAULT_MACHINE_NAME,
  findMachineByName,
  Machine,
  validLeoDataprocWorkerMachineTypes,
} from 'app/utils/machines';

import { DiskSizeSelector } from './disk-size-selector';

const { useState, useEffect } = React;

export const DataProcConfigSelector = ({
  onChange,
  disabled,
  runtimeStatus,
  dataprocExists,
  dataprocConfig,
}) => {
  const {
    workerMachineType = DEFAULT_MACHINE_NAME,
    workerDiskSize = DATAPROC_MIN_DISK_SIZE_GB,
    numberOfWorkers = 2,
    numberOfPreemptibleWorkers = 0,
  } = dataprocConfig || {};
  const initialMachine = findMachineByName(workerMachineType);
  const [selectedNumWorkers, setSelectedNumWorkers] =
    useState<number>(numberOfWorkers);
  const [selectedPreemtible, setSelectedPreemptible] = useState<number>(
    numberOfPreemptibleWorkers
  );
  const [selectedWorkerMachine, setSelectedWorkerMachine] =
    useState<Machine>(initialMachine);
  const [selectedDiskSize, setSelectedDiskSize] =
    useState<number>(workerDiskSize);

  // If the dataprocConfig prop changes externally, reset the selectors accordingly.
  useEffect(() => {
    setSelectedNumWorkers(numberOfWorkers);
    setSelectedPreemptible(numberOfPreemptibleWorkers);
    setSelectedWorkerMachine(initialMachine);
    setSelectedDiskSize(workerDiskSize);
  }, [dataprocConfig]);

  useEffect(() => {
    onChange({
      ...dataprocConfig,
      workerMachineType: selectedWorkerMachine?.name,
      workerDiskSize: selectedDiskSize,
      numberOfWorkers: selectedNumWorkers,
      numberOfPreemptibleWorkers: selectedPreemtible,
    });
  }, [
    selectedNumWorkers,
    selectedPreemtible,
    selectedWorkerMachine,
    selectedDiskSize,
  ]);

  // As a special case in Dataproc, worker counts can be dynamically changed on
  // a running cluster but not on a stopped cluster. Rather than building a
  // one-off resume->update workflow into Workbench, just disable the control
  // and let the user resume themselves.
  const workerCountDisabledByStopped =
    dataprocExists && runtimeStatus === RuntimeStatus.Stopped;
  const workerCountTooltip = workerCountDisabledByStopped
    ? 'Cannot update worker counts on a stopped Dataproc environment, please start your environment first.'
    : undefined;

  return (
    <fieldset style={{ marginTop: '0.75rem' }}>
      <legend style={styles.sectionTitle}>Worker Configuration</legend>
      <div style={styles.formGrid3}>
        <FlexRow style={styles.labelAndInput}>
          <label style={styles.label} htmlFor='num-workers'>
            Workers
          </label>
          <InputNumber
            id='num-workers'
            showButtons
            disabled={disabled || workerCountDisabledByStopped}
            decrementButtonClassName='p-button-secondary'
            incrementButtonClassName='p-button-secondary'
            value={selectedNumWorkers}
            inputStyle={styles.inputNumber}
            tooltip={workerCountTooltip}
            onChange={({ value }) => setSelectedNumWorkers(value)}
          />
        </FlexRow>
        <FlexRow style={styles.labelAndInput}>
          <label style={styles.label} htmlFor='num-preemptible'>
            Preemptible workers
            <TooltipTrigger
              content='Preemptible secondary workers can be added in addition to
                primary workers. They are less expensive than primary workers
                but may be removed from the cluster if they are required by
                Google Cloud for other tasks. This may affect job stability'
            >
              <InfoIcon
                style={{ marginLeft: '0.1rem', height: '18px', width: '18px' }}
              />
            </TooltipTrigger>
          </label>
          <InputNumber
            id='num-preemptible'
            showButtons
            disabled={disabled || workerCountDisabledByStopped}
            decrementButtonClassName='p-button-secondary'
            incrementButtonClassName='p-button-secondary'
            value={selectedPreemtible}
            inputStyle={styles.inputNumber}
            tooltip={workerCountTooltip}
            onChange={({ value }) => setSelectedPreemptible(value)}
          />
        </FlexRow>
        <div style={{ gridColumnEnd: 'span 1' }} />
        <MachineSelector
          machineType={workerMachineType}
          onChange={setSelectedWorkerMachine}
          selectedMachine={selectedWorkerMachine}
          disabled={disabled}
          validMachineTypes={validLeoDataprocWorkerMachineTypes}
          idPrefix='worker'
          cpuLabelStyles={{ minWidth: '2.5rem' }} // width of 'Workers' label above
          ramLabelStyles={{ minWidth: '3.75rem' }} // width of 'Preemptible' label above
        />
        <DiskSizeSelector
          diskSize={workerDiskSize}
          onChange={setSelectedDiskSize}
          disabled={disabled}
          idPrefix='worker'
        />
      </div>
    </fieldset>
  );
};
