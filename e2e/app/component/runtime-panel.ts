import { Page } from 'puppeteer';
import SelectMenu from 'app/component/select-menu';
import PrimereactInputNumber from 'app/element/primereact-input-number';
import { LinkText, SideBarLink } from 'app/text-labels';
import Button from 'app/element/button';
import NotebookPreviewPage from 'app/page/notebook-preview-page';
import BaseHelpSidebar from './base-help-sidebar';
import { logger } from 'libs/logger';
import RadioButton from 'app/element/radiobutton';
import { config } from 'resources/workbench-config';

const defaultXpath = '//*[@id="runtime-panel"]';

export enum AutoPauseIdleTime {
  ThirtyMinutes = '30 minutes (default)',
  EightHours = '8 hours'
}

export enum StartStopIconState {
  Error = 'error',
  None = 'none',
  Running = 'running',
  Starting = 'starting',
  Stopped = 'stopped',
  Stopping = 'stopping'
}

export enum ComputeType {
  Standard = 'Standard VM',
  Dataproc = 'Dataproc Cluster'
}

export enum RuntimePreset {
  GeneralAnalysis = 'General Analysis',
  HailGenomicsAnalysis = 'Hail Genomics Analysis'
}

export default class RuntimePanel extends BaseHelpSidebar {
  constructor(page: Page, xpath: string = defaultXpath) {
    super(page);
    super.setXpath(`${super.getXpath()}${xpath}`);
  }

  async pickCpus(cpus: number): Promise<void> {
    const cpusDropdown = SelectMenu.findByName(this.page, { id: 'runtime-cpu' }, this);
    return await cpusDropdown.select(cpus.toString());
  }

  async getCpus(): Promise<string> {
    const cpusDropdown = SelectMenu.findByName(this.page, { id: 'runtime-cpu' }, this);
    return await cpusDropdown.getSelectedValue();
  }

  async pickRamGbs(ramGbs: number): Promise<void> {
    const ramDropdown = SelectMenu.findByName(this.page, { id: 'runtime-ram' }, this);
    return await ramDropdown.select(ramGbs.toString());
  }

  async getRamGbs(): Promise<string> {
    const ramDropdown = SelectMenu.findByName(this.page, { id: 'runtime-ram' }, this);
    return await ramDropdown.getSelectedValue();
  }

  async pickDiskGbs(diskGbs: number): Promise<void> {
    const diskInput = new PrimereactInputNumber(this.page, '//*[@id="runtime-disk"]');
    return await diskInput.setValue(diskGbs);
  }

  getDiskInput(): PrimereactInputNumber {
    return new PrimereactInputNumber(this.page, '//*[@id="runtime-disk"]');
  }

  async getDiskGbs(): Promise<number> {
    const diskInput = this.getDiskInput();
    return await diskInput.getInputValue();
  }

  getComputeTypeSelect(): SelectMenu {
    return SelectMenu.findByName(this.page, { id: 'runtime-compute' }, this);
  }

  async pickComputeType(computeType: ComputeType): Promise<void> {
    const computeTypeDropdown = this.getComputeTypeSelect();
    return await computeTypeDropdown.select(computeType);
  }

  getAutoPauseSelect(): SelectMenu {
    return SelectMenu.findByName(this.page, { id: 'runtime-autopause' }, this);
  }

  async pickAutoPauseTime(pauseTime: AutoPauseIdleTime): Promise<void> {
    const autoPauseDropdown = this.getAutoPauseSelect();
    return await autoPauseDropdown.select(pauseTime);
  }

  async pickDataprocNumWorkers(numWorkers: number): Promise<void> {
    const dataprocNumWorkers = new PrimereactInputNumber(this.page, '//*[@id="num-workers"]');
    return await dataprocNumWorkers.setValue(numWorkers);
  }

  async getDataprocNumWorkers(): Promise<number> {
    const dataprocNumWorkers = new PrimereactInputNumber(this.page, '//*[@id="num-workers"]');
    return await dataprocNumWorkers.getInputValue();
  }

  async pickDataprocNumPreemptibleWorkers(numPreemptibleWorkers: number): Promise<void> {
    const dataprocNumPreemptibleWorkers = new PrimereactInputNumber(this.page, '//*[@id="num-preemptible"]');
    return await dataprocNumPreemptibleWorkers.setValue(numPreemptibleWorkers);
  }

  async getDataprocNumPreemptibleWorkers(): Promise<number> {
    const dataprocNumPreemptibleWorkers = new PrimereactInputNumber(this.page, '//*[@id="num-preemptible"]');
    return await dataprocNumPreemptibleWorkers.getInputValue();
  }

  async pickWorkerCpus(workerCpus: number): Promise<void> {
    const workerCpusDropdown = SelectMenu.findByName(this.page, { id: 'worker-cpu' }, this);
    return await workerCpusDropdown.select(workerCpus.toString());
  }

  async getWorkerCpus(): Promise<string> {
    const workerCpusDropdown = SelectMenu.findByName(this.page, { id: 'worker-cpu' }, this);
    return await workerCpusDropdown.getSelectedValue();
  }

  async pickWorkerRamGbs(workerRamGbs: number): Promise<void> {
    const workerRamDropdown = SelectMenu.findByName(this.page, { id: 'worker-ram' }, this);
    return await workerRamDropdown.select(workerRamGbs.toString());
  }

  async getWorkerRamGbs(): Promise<string> {
    const workerRamDropdown = SelectMenu.findByName(this.page, { id: 'worker-ram' }, this);
    return await workerRamDropdown.getSelectedValue();
  }

  async pickWorkerDisk(workerDiskGbs: number): Promise<void> {
    const workerDiskInput = new PrimereactInputNumber(this.page, '//*[@id="worker-disk"]');
    return await workerDiskInput.setValue(workerDiskGbs);
  }

  async getWorkerDisk(): Promise<number> {
    const workerDiskInput = new PrimereactInputNumber(this.page, '//*[@id="worker-disk"]');
    return await workerDiskInput.getInputValue();
  }

  async pickRuntimePreset(runtimePreset: RuntimePreset): Promise<void> {
    const runtimePresetMenu = SelectMenu.findByName(this.page, { id: 'runtime-presets-menu' }, this);
    return await runtimePresetMenu.select(runtimePreset);
  }

  buildStatusIconDataTestId = (startStopIconState: StartStopIconState): string => {
    return `//*[@data-test-id="runtime-status-icon-${startStopIconState}"]`;
  };

  /**
   * Wait up to 20 minutes before timing out here. We expect runtime changes to be quite slow.
   *   So we want to give a generous amount of time before failing the test.
   * @param startStopIconState
   * @param timeout
   */
  async waitForStartStopIconState(
    startStopIconState: StartStopIconState,
    timeout: number = 20 * 60 * 1000
  ): Promise<void> {
    const xpath = this.buildStatusIconDataTestId(startStopIconState);
    await this.page.waitForXPath(xpath, { visible: true, timeout });
  }

  async clickPauseRuntimeIcon(): Promise<void> {
    const xpath = this.buildStatusIconDataTestId(StartStopIconState.Running);
    const icon = new Button(this.page, xpath);
    await icon.click();
  }

  async clickResumeRuntimeIcon(): Promise<void> {
    const xpath = this.buildStatusIconDataTestId(StartStopIconState.Stopped);
    const icon = new Button(this.page, xpath);
    await icon.click();
  }

  async open(): Promise<void> {
    const isOpen = await this.isVisible();
    if (isOpen) {
      return;
    }
    await this.clickIcon(SideBarLink.ComputeConfiguration);
    await this.getDeleteIcon();
    await this.waitUntilVisible();
    // Wait for visible texts
    await this.page.waitForXPath(`${this.getXpath()}//h3`, { visible: true });
    // Wait for visible button
    await this.page.waitForXPath(`${this.getXpath()}//*[@role="button" and @aria-label]`, { visible: true });
    logger.info(`Opened "${await this.getTitle()}" runtime sidebar`);
  }

  /**
   * Create runtime and wait until running.
   */
  async createRuntime(opt: { waitForComplete?: boolean; timeout?: number } = {}): Promise<void> {
    const { waitForComplete = true, timeout = 10 * 60 * 1000 } = opt;
    await this.open();

    const isRunning = await this.isRunning();
    if (isRunning) {
      logger.info('Runtime is already running. Create new runtime is not needed.');
      return;
    }

    await this.waitForStartStopIconState(StartStopIconState.None);
    await this.clickButton(LinkText.Create);
    await this.waitUntilClose(); // Runtime panel automatically close after click Create button.
    logger.info('Creating new runtime');

    if (waitForComplete) {
      // Reopen panel in order to check icon status.
      await this.open();
      // Runtime state transition: Starting -> Running
      await this.waitForStartStopIconState(StartStopIconState.Starting, timeout);
      await this.waitForStartStopIconState(StartStopIconState.Running);
      await this.close();
      logger.info('Runtime is running');
    }
  }

  /**
   * Delete runtime.
   */
  async deleteRuntime(): Promise<void> {
    logger.info('Deleting runtime');
    await this.open();
    await this.clickDeleteEnvironmentButton();
    await this.waitUntilClose();
    // Runtime panel automatically close after click Create button.
    // Reopen panel in order to check icon status.
    await this.open();
    await this.waitForStartStopIconState(StartStopIconState.None);
    await this.close();
    logger.info('Runtime is deleted');
  }

  /**
   * Pause runtime.
   */
  async pauseRuntime(): Promise<void> {
    logger.info('Pausing runtime');
    await this.open();
    await this.waitForStartStopIconState(StartStopIconState.Running, 60 * 1000);
    await this.clickPauseRuntimeIcon();
    // Runtime state transition: Stopping -> Stopped
    await this.waitForStartStopIconState(StartStopIconState.Stopping);
    await this.waitForStartStopIconState(StartStopIconState.Stopped);
    await this.close();
    logger.info('Runtime is paused');
  }

  /**
   * Resume runtime.
   */
  async resumeRuntime(): Promise<void> {
    logger.info('Resuming runtime');
    await this.open();
    await this.clickResumeRuntimeIcon();
    // Runtime state transition: Stopped -> Starting -> Running
    await this.waitForStartStopIconState(StartStopIconState.Stopped);
    await this.waitForStartStopIconState(StartStopIconState.Starting);
    await this.waitForStartStopIconState(StartStopIconState.Running);
    await this.close();
    logger.info('Runtime is resumed');
  }

  /**
   * Delete unattached persistent disk.
   */
  async deleteUnattachedPd(): Promise<void> {
    logger.info('Deleting unattached persistent disk');
    await this.open();
    await this.clickButton(LinkText.DeletePd);
    // Select "Delete gce runtime and pd" radiobutton.
    await RadioButton.findByName(this.page, { dataTestId: 'delete-unattached-pd' }).select();
    await this.clickButton(LinkText.Delete);
    await this.waitUntilClose();
    logger.info('Unattached persistent disk is deleted');
  }

  async applyChanges(): Promise<NotebookPreviewPage> {
    await this.clickButton(LinkText.Next);
    await this.clickButton(LinkText.ApplyRecreate);
    await this.waitUntilClose();

    // Automatically opens the Preview page
    const notebookPreviewPage = new NotebookPreviewPage(this.page);
    await notebookPreviewPage.waitForLoad();

    // Wait for new runtime running. The runtime status transition from Stopping to None to Running
    await this.open();
    await this.waitForStartStopIconState(StartStopIconState.Stopping);
    await this.waitForStartStopIconState(StartStopIconState.None);
    await this.waitForStartStopIconState(StartStopIconState.Starting);
    await this.waitForStartStopIconState(StartStopIconState.Running);

    return notebookPreviewPage;
  }

  getCustomizeButton(): Button {
    return Button.findByName(this.page, { normalizeSpace: LinkText.Customize }, this);
  }

  // runtime status spinner.
  async existStatusIcon(timeout?: number): Promise<boolean> {
    const runtimeStatusSpinner = '//*[@data-test-id="runtime-status-icon-container"]/*[@data-icon="sync-alt"]';
    return this.page
      .waitForXPath(runtimeStatusSpinner, { visible: true, timeout })
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }

  /**
   * Open Runtime sidebar, check status for running.
   */
  async waitForRunningAndClose(timeout?: number): Promise<boolean> {
    const runtimeSidebar = new RuntimePanel(this.page);
    await runtimeSidebar.open();
    try {
      await runtimeSidebar.waitForStartStopIconState(StartStopIconState.Running, timeout);
      return true;
    } catch (err) {
      return false;
    } finally {
      await runtimeSidebar.close();
    }
  }

  async isRunning(): Promise<boolean> {
    const xpath = this.buildStatusIconDataTestId(StartStopIconState.Running);
    return this.page
      .waitForXPath(xpath, { visible: true, timeout: 1000 })
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }

  async clickDeleteEnvironmentButton(): Promise<void> {
    await this.clickButton(LinkText.DeleteEnvironment);
    // Select "Delete gce runtime and pd" radiobutton when PD-disk is enabled.
    if (config.ENABLED_PERSISTENT_DISK) {
      await RadioButton.findByName(this.page, { dataTestId: 'delete-runtime' }).select();
    }
    await this.clickButton(LinkText.Delete);
  }
}
