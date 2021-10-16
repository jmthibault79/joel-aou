import * as fs from 'fs';
import { ElementHandle, Frame, Page } from 'puppeteer';
import { getPropValue } from 'utils/element-utils';
import { waitForDocumentTitle, waitForNumericalString, waitWhileLoading } from 'utils/waits-utils';
import { ResourceCard } from 'app/text-labels';
import RuntimePanel, { StartStopIconState } from 'app/component/runtime-panel';
import NotebookCell, { CellType } from './notebook-cell';
import NotebookDownloadModal from 'app/modal/notebook-download-modal';
import NotebookPreviewPage from './notebook-preview-page';
import WorkspaceAnalysisPage from './workspace-analysis-page';
import WorkspaceDataPage from './workspace-data-page';
import Link from 'app/element/link';
import NotebookFrame from './notebook-frame';
import { logger } from 'libs/logger';
import expect from 'expect';
import ReplaceFileModal from 'app/modal/replace-file-modal';
import { takeScreenshot } from 'utils/save-file-utils';
import { config } from 'resources/workbench-config';

// CSS selectors
const CssSelector = {
  body: 'body.notebook_app',
  notebookContainer: '#notebook-container',
  toolbarContainer: '#maintoolbar-container',
  runCellButton: 'button[data-jupyter-action="jupyter-notebook:run-cell-and-select-next"]',
  saveNotebookButton: 'button[data-jupyter-action="jupyter-notebook:save-notebook"]',
  kernelIcon: '#kernel_indicator_icon',
  kernelName: '.kernel_indicator_name'
};

const Xpath = {
  fileMenuDropdown: './/a[text()="File"]',
  cellMenuDropdown: './/*[@id="menubar"]//a[@id="celllink" and @aria-controls="cell_menu"]',
  downloadMenuDropdown: './/a[text()="Download as"]',
  downloadIpynbButton: './/*[@id="download_script"]/a',
  downloadMarkdownButton: './/*[@id="download_markdown"]/a',
  open: './/*[@id="open_notebook"]/a',
  runAllCode: './/*[@id="menubar"]//li[@class="dropdown open"]//*[@id="run_all_cells"]/a[@role="menuitem"]'
};

export enum Mode {
  Command = 'command_mode',
  Edit = 'edit_mode'
}

export enum KernelStatus {
  NotRunning = 'Kernel is not running',
  Idle = 'Kernel Idle'
}

export default class NotebookPage extends NotebookFrame {
  constructor(page: Page, private readonly documentTitle: string) {
    super(page);
  }

  async isLoaded(): Promise<boolean> {
    await waitForDocumentTitle(this.page, this.documentTitle);
    try {
      await this.findRunButton(120000);
    } catch (err) {
      console.warn(`Reloading "${this.documentTitle}" because cannot find the Run button`);
      await this.page.reload();
    }
    // When open notebook for the first time, notebook websocket can close unexpectedly that causes kernel disconnect unexpectedly.
    // Thus, a longer sleep interval is required.
    await this.waitForKernelIdle(10 * 60 * 1000, 10000); // 10 minutes
    return true;
  }

  /**
   * Click "Notebook" link, goto Workspace Analysis page.
   * This function does not handle Unsaved Changes confirmation.
   */
  async goAnalysisPage(): Promise<WorkspaceAnalysisPage> {
    const selector = '//a[text()="Notebooks"]';
    const navPromise = this.page.waitForNavigation({ waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });
    await this.page.waitForXPath(selector, { visible: true }).then((link) => link.click());
    await navPromise;
    await waitWhileLoading(this.page);
    const analysisPage = new WorkspaceAnalysisPage(this.page);
    await analysisPage.waitForLoad();
    return analysisPage;
  }

  /**
   * Click workspace name, goto Workspace Data page.
   * This function does not handle Unsaved Changes confirmation.
   */
  async goDataPage(): Promise<WorkspaceDataPage> {
    const navPromise = this.page.waitForNavigation({ waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });
    await this.getWorkspaceLink().click();
    await navPromise;
    const dataPage = new WorkspaceDataPage(this.page);
    await dataPage.waitForLoad();
    return dataPage;
  }

  getWorkspaceLink(): Link {
    const selector = '//a[contains(@href, "/data")]';
    return new Link(this.page, selector);
  }

  async openUploadFilePage(): Promise<Page> {
    // Select File menu => Open.
    await this.selectFileOpenMenu();

    // New tab opens. "browser" is a Jest-Puppeteer global variable.
    const newTarget = await browser.waitForTarget((target) => target.opener() === this.page.target());
    const newPage = await newTarget.page();

    // Upload button that triggers file selection dialog.
    const uploadButtonSelector = 'input#upload_span_input';
    await newPage.waitForSelector(uploadButtonSelector, { visible: true });
    return newPage;
  }

  async acceptDataUsePolicyDialog(page: Page): Promise<void> {
    const expectedMessage =
      'It is All of Us data use policy to not upload data or files containing personally identifiable information';
    page.on('dialog', async (dialog) => {
      await page.waitForTimeout(500);
      const modalMessage = dialog.message();
      // If this is not the Data Use Policy dialog, error is thrown.
      expect(modalMessage).toContain(expectedMessage);
      await dialog.accept();
      await page.waitForTimeout(500);
      console.log('Accept "Data Use Policy" dialog');
    });
  }

  async chooseFile(page: Page, pyFilePath: string): Promise<void> {
    // Upload button that triggers file selection dialog.
    const uploadButtonSelector = 'input#upload_span_input';
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }),
      page
        .waitForSelector(uploadButtonSelector)
        .then((button) => button.click({ delay: 10 }))
        .then(() => {
          page.waitForTimeout(500);
        })
    ]);
    await fileChooser.accept([pyFilePath]);
  }

  /**
   * Run focused cell and insert a new cell below. Click Run button in toolbar.
   */
  async run(timeout = 60000): Promise<void> {
    logger.info('Click notebook Run button.');
    await this.waitForKernelIdle(timeout, 1000);
    const runButton = await this.findRunButton();
    await runButton.click();
    await runButton.dispose();
    // Click Run button turns notebook page into Command_mode from Edit mode.
    // Short sleep to avoid check output too soon.
    await this.page.waitForTimeout(200);
    await this.waitForKernelIdle(timeout, 2000);
  }

  /**
   * Save notebook. Click Save button in toolbar.
   */
  async save(): Promise<void> {
    const frame = await this.getIFrame();
    const saveButton = await frame.waitForSelector(CssSelector.saveNotebookButton, { visible: true });
    await saveButton.click();
    await saveButton.dispose();
    // Puppeteer slowmo is not set and playback is very fast.
    // Need a short pause here after click SAVE button to allow click to finish. Otherwise, it can cause tests to fail.
    // See https://precisionmedicineinitiative.atlassian.net/browse/RW-7228 for more details.
    await this.page.waitForTimeout(500);
  }

  async selectFileOpenMenu(): Promise<void> {
    const clickFileMenuIcon = async (iframe: Frame): Promise<void> => {
      await iframe.waitForXPath(Xpath.fileMenuDropdown, { visible: true, timeout: 2000 }).then((element) => {
        element.hover();
        element.click();
      });
    };

    let maxRetries = 3;
    const clickAndCheck = async (iframe: Frame) => {
      await clickFileMenuIcon(iframe);
      const succeeded = await iframe
        .waitForXPath(Xpath.open, { visible: true, timeout: 2000 })
        .then((menuitem) => {
          menuitem.hover();
          menuitem.click();
          return true;
        })
        .catch(() => {
          return false;
        });
      if (succeeded) {
        return;
      }
      if (maxRetries <= 0) {
        throw new Error('Failed to click File menu -> Download.');
      }
      maxRetries--;
      await this.page.waitForTimeout(1000).then(() => clickAndCheck(iframe)); // 1 second pause and retry.
    };

    const frame = await this.getIFrame();
    await clickAndCheck(frame);
    await this.page.waitForTimeout(500);
  }

  private async downloadAs(formatXpath: string): Promise<NotebookDownloadModal> {
    const clickFileMenuIcon = async (iframe: Frame): Promise<void> => {
      await iframe.waitForXPath(Xpath.fileMenuDropdown, { visible: true, timeout: 2000 }).then((element) => {
        element.hover();
        element.click();
      });
    };

    let maxRetries = 3;
    const clickAndCheck = async (iframe: Frame) => {
      await clickFileMenuIcon(iframe);
      const succeeded = await iframe
        .waitForXPath(Xpath.downloadMenuDropdown, { visible: true, timeout: 2000 })
        .then((menuitem) => {
          menuitem.hover();
          return true;
        })
        .catch(() => {
          return false;
        });
      if (succeeded) {
        return;
      }
      if (maxRetries <= 0) {
        throw new Error('Failed to click File menu -> Download.');
      }
      maxRetries--;
      await this.page.waitForTimeout(1000).then(() => clickAndCheck(iframe)); // 1 second pause and retry.
    };

    const frame = await this.getIFrame();
    await clickAndCheck(frame);
    await this.page.waitForTimeout(500);
    const menuOption = await frame.waitForXPath(formatXpath, { visible: true });
    await menuOption.hover();
    await menuOption.click();

    const modal = new NotebookDownloadModal(this.page);
    return modal.waitForLoad();
  }

  async downloadAsIpynb(): Promise<NotebookDownloadModal> {
    return this.downloadAs(Xpath.downloadIpynbButton);
  }

  async downloadAsMarkdown(): Promise<NotebookDownloadModal> {
    return this.downloadAs(Xpath.downloadMarkdownButton);
  }

  async isIdle(timeout = 1000): Promise<boolean> {
    const frame = await this.getIFrame();
    const idleIconSelector = `${CssSelector.kernelIcon}.kernel_idle_icon`;
    const notificationSelector = '#notification_kernel';
    return Promise.all([
      frame.waitForSelector(idleIconSelector, { visible: true, timeout }),
      frame.waitForSelector(notificationSelector, { hidden: true, timeout })
    ])
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Wait for notebook kernel becomes ready (idle).
   */
  async waitForKernelIdle(timeOut = 300000, sleepInterval = 5000): Promise<boolean> {
    // Check kernel status twice with a pause between two checks because kernel status can suddenly become not ready.
    let ready = false;
    const startTime = Date.now();
    while (Date.now() - startTime < timeOut) {
      const idle = await this.isIdle(2000);
      if (ready && idle) {
        return true;
      }
      ready = idle;
      await this.page.waitForTimeout(sleepInterval);
    }
    // Throws exception if not ready.
    const status = await this.getKernelStatus();
    throw new Error(
      `Notebook kernel is not idle after waiting ${timeOut} seconds. Actual kernel status was ${status}.`
    );
  }

  async getKernelStatus(): Promise<KernelStatus | string> {
    const frame = await this.getIFrame();
    const elemt = await frame.waitForSelector(CssSelector.kernelIcon, { visible: true });
    const value = await getPropValue<string>(elemt, 'title');
    await elemt.dispose();
    Object.keys(KernelStatus).forEach((key) => {
      if (KernelStatus[key] === value) {
        return key;
      }
    });
    return value;
  }

  async getKernelName(): Promise<string> {
    const frame = await this.getIFrame();
    const elemt = await frame.waitForSelector(CssSelector.kernelName, { visible: true });
    const value = await getPropValue<string>(elemt, 'textContent');
    await elemt.dispose();
    return value.trim();
  }

  /**
   *
   * @param {number} cellIndex Code Cell index. (first index is 1)
   * @param {CellType} cellType: Code or Markdown cell. Default value is Code cell.
   */
  findCell(cellIndex: number, cellType: CellType = CellType.Code): NotebookCell {
    const cell = new NotebookCell(this.page, cellType, cellIndex);
    return cell;
  }

  /**
   * Find the last cell.
   * @param {CellType} cellType: Code or Markdown cell. Default value is Code cell.
   */
  async findLastCell(cellType: CellType = CellType.Code): Promise<NotebookCell | null> {
    const cell = new NotebookCell(this.page, cellType);
    await cell.getLastCell();
    return cell;
  }

  /**
   * Click Run button in toolbar. Run focused code cell and insert a new code cell below.
   *
   * @param {number} cellIndex Code Cell index. (first index is 1). Use -1 to find last cell.
   * @param opts
   *  {string} code The code to run.
   *  {string} codeFile The full path to a file that contains the code to run.
   *  {number} timeOut The timeout time in milliseconds (default 120 sec).
   *  {boolean} markdownWorkaround Convert to Markdown before typing (default false)
   */
  async runCodeCell(
    cellIndex: number,
    opts: { code?: string; codeFile?: string; timeOut?: number; markdownWorkaround?: boolean } = {}
  ): Promise<string> {
    const { code, codeFile, timeOut = 2 * 60 * 1000, markdownWorkaround = false } = opts;
    if (code !== undefined && codeFile !== undefined) {
      throw new Error('Code and codeFile parameters are both defined. Only one is required in runCodeCell method.');
    }
    let notebookCode: string;
    if (code !== undefined) {
      notebookCode = code;
    } else if (codeFile !== undefined) {
      notebookCode = fs.readFileSync(codeFile, 'ascii');
    }

    // Check kernel idle again before typing code.
    await this.waitForKernelIdle(60000, 1000);
    const codeCell = cellIndex === -1 ? await this.findLastCell() : this.findCell(cellIndex);
    const cellInputTextbox = await codeCell.focus();

    // autoCloseBrackets is true by default for R code cells.
    // Puppeteer types in every character of code, resulting in extra brackets.
    // Workaround: Type code in Markdown cell, then change to Code cell to run.
    if (notebookCode) {
      if (markdownWorkaround) {
        await this.changeToMarkdownCell();
        const markdownCell = this.findCell(cellIndex, CellType.Markdown);
        const markdownCellInput = await markdownCell.focus();
        await markdownCellInput.type(notebookCode);
        await this.changeToCodeCell();
      } else {
        await cellInputTextbox.type(notebookCode);
      }
      logger.info(`Type notebook code:\n--------${notebookCode}\n--------`);
    }

    await this.run(timeOut);
    const codeOutput = await codeCell.waitForOutput(timeOut);
    logger.info(`Notebook code output:\n${codeOutput}`);
    return codeOutput;
  }

  async runCodeFile(cellIndex: number, fileName: string, timeout?: number) {
    const codeCell = this.findCell(cellIndex);
    const cellInput = await codeCell.focus();
    // Open file in notebook cell.
    await cellInput.type(`%load ${fileName}`);
    await this.run(timeout);
    await this.waitForKernelIdle(10000, 2000); // load file into cell should be very quick.
    // run code.
    await codeCell.focus();
    await this.run();
    const codeOutput = await codeCell.waitForOutput(timeout);
    logger.info(`Notebook load "${fileName}". Code output:\n${codeOutput}`);
    return codeOutput;
  }

  async runAllCells(): Promise<void> {
    // Initial value is the max num of retries.
    for (let retries = 3; retries > 0; retries--) {
      const iframe = await this.getIFrame();
      const succeeded = async (): Promise<boolean> => {
        try {
          // Open Cell menu dropdown.
          const cellMenu = await iframe.waitForXPath(Xpath.cellMenuDropdown, { visible: true, timeout: 2000 });
          await cellMenu.hover();
          await cellMenu.click();
          await this.page.waitForTimeout(1000);
          // Click Run All menuitem.
          const runAllMenuItem = await iframe.waitForXPath(Xpath.runAllCode, { visible: true, timeout: 2000 });
          await runAllMenuItem.hover();
          await runAllMenuItem.click();
          return true;
        } catch (err) {
          logger.error(err);
          return false;
        }
      };
      // If it's another retry, pause half second before retry.
      // If succeeded, pause to avoid check code output too soon.
      await this.page.waitForTimeout(500);
      if (await succeeded()) {
        logger.info('Notebook: Run All Cell.');
        return;
      }
    }
    throw new Error('Failed to click Cell menu -> Run All.');
  }

  // Upload a file, open file in notebook cell, then run code.
  async uploadFile(fileName: string, filePath: string): Promise<void> {
    // Select File menu => Open to open Upload tab.
    const newPage = await this.openUploadFilePage();

    // The first dialog that open up is "Data Use Policy" dialog: verify message and close dialog.
    await this.acceptDataUsePolicyDialog(newPage);

    // Upload button that triggers file selection dialog.
    await this.chooseFile(newPage, filePath);

    // Upload button that uploads the file is visible.
    const fileUploadButtonSelector =
      '//*[@id="notebook_list"]//*[contains(@class, "new-file")]' +
      `[.//input[@class="filename_input" and @value="${fileName}"]]//button[text()="Upload"]`;
    const uploadButton = new Link(newPage, fileUploadButtonSelector);
    await uploadButton.focus();
    await uploadButton.click({ delay: 10 });

    // Handle "Replace file" dialog if found: Do not overwrite existing file, click CANCEL button to dismiss dialog.
    // Previously uploaded file persist because same workspace is used during the day.
    const replaceFileMessage = `There is already a file named "${fileName}". Do you want to replace it?`;
    const replaceFileModal = new ReplaceFileModal(newPage);
    const exists = await replaceFileModal.isLoaded();
    if (exists) {
      const modalMessage = await replaceFileModal.getText();
      expect(modalMessage).toContain(replaceFileMessage);
      await replaceFileModal.clickCancelButton();
      await newPage.waitForTimeout(500);
      console.log(`Cancel to close "Replace file" "${fileName}" dialog`);
    }

    // Get file size.
    const fileSizeXpath =
      '//*[@id="notebook_list"]//*[contains(@class,"list_item")]' +
      `[.//a[@class="item_link"]/*[normalize-space()="${fileName}"]]//*[contains(@class, "file_size")]`;
    await waitForNumericalString(newPage, fileSizeXpath);
    const fileSizeElement = await newPage.waitForXPath(fileSizeXpath, { visible: true });
    const fileSize = await getPropValue(fileSizeElement, 'textContent');

    // In case page has to be checked after finish.
    await takeScreenshot(newPage, `notebook-upload-file-${fileName}.png`);

    await newPage.close();
    await this.page.bringToFront();
    await this.waitForKernelIdle();
    logger.info(`Notebook uploaded file "${fileName}". (file size: ${fileSize})`);
  }

  /**
   * Returns cell input and output texts in an array. Not waiting for output rendered.
   * @param {number} cellIndex Code Cell index. (first index is 1)
   * @param {CellType} cellType: Markdown or Code. Default value is Code cell.
   */
  async getCellInputOutput(cellIndex: number, cellType: CellType = CellType.Code): Promise<[string, string]> {
    const cell = this.findCell(cellIndex, cellType);
    const code = await cell.getInputText();
    const output = await cell.waitForOutput(1000);
    return [code, output];
  }

  /**
   * Delete notebook
   */
  async deleteNotebook(notebookName: string): Promise<void> {
    const analysisPage = await this.goAnalysisPage();
    await analysisPage.deleteResource(notebookName, ResourceCard.Notebook);
  }

  /**
   * Delete runtime
   */
  async deleteRuntime(): Promise<void> {
    // Open runtime panel
    const runtimePanel = new RuntimePanel(this.page);
    await runtimePanel.open();
    await runtimePanel.clickDeleteEnvironmentButton();

    const notebookPreviewPage = new NotebookPreviewPage(this.page);
    await notebookPreviewPage.waitForLoad();

    // Wait until runtime status indicates None.
    await runtimePanel.open();
    await runtimePanel.waitForStartStopIconState(StartStopIconState.Stopping);
    await runtimePanel.waitForStartStopIconState(StartStopIconState.None);
    await runtimePanel.close();
  }

  /**
   * Delete unattached persistent disk
   */
  async deleteUnattachedPd(): Promise<void> {
    if (config.ENABLED_PERSISTENT_DISK) {
      // Open runtime panel
      const runtimePanel = new RuntimePanel(this.page);
      await runtimePanel.open();

      // Click 'delete persistent disk' then Delete buttons.
      await runtimePanel.deleteUnattachedPd();
    }
  }

  private async findRunButton(timeout?: number): Promise<ElementHandle> {
    const frame = await this.getIFrame();
    return frame.waitForSelector(CssSelector.runCellButton, { visible: true, timeout });
  }

  // ****************************************************************************

  /**
   * Change selected cell type to Markdown.
   */
  async changeToMarkdownCell(): Promise<void> {
    await this.toggleMode(Mode.Command);
    await this.page.keyboard.press('M');
    await this.page.waitForTimeout(500);
  }

  /**
   * Change selected cell type to Code.
   */
  async changeToCodeCell(): Promise<void> {
    await this.toggleMode(Mode.Command);
    await this.page.keyboard.press('Y');
    await this.page.waitForTimeout(500);
  }

  /**
   * Active Notebook Command or Edit mode.
   * @param mode
   */
  async toggleMode(mode: Mode): Promise<void> {
    // Press Esc key to activate command mode
    if (mode === Mode.Command) {
      await this.page.keyboard.press('Escape');
      await this.getIFrame().then((frame) => frame.waitForSelector('body.notebook_app.command_mode'));
      return;
    }
    // Press Enter key to activate edit mode
    await this.page.keyboard.press('Enter');
    await this.getIFrame().then((frame) => frame.waitForSelector('body.notebook_app.edit_mode'));
    return;
  }

  /**
   * Run (Execute) cells using Shift+Enter keys.
   * Shortcut explanation: Shift+Enter run cells and select below.
   */
  async runCellShiftEnter(): Promise<void> {
    return this.runCommand('Shift');
  }

  /**
   * Run (Execute) cells using Ctrl+Enter keys.
   * Shortcut explanation: Ctrl+Enter run selected cells.
   */
  async runCellCtrlEnter(): Promise<void> {
    return this.runCommand('Control');
  }

  /**
   * Run (Execute) cells using Alt+Enter keys.
   * Shortcut explanation: Alt+Enter run cells and insert below.
   */
  async runCellAltEnter(): Promise<void> {
    return this.runCommand('Alt');
  }

  private async runCommand(keyboardCommand: string): Promise<void> {
    await this.page.bringToFront();
    await this.page.keyboard.down(keyboardCommand);
    await this.page.keyboard.press('Enter', { delay: 20 });
    await this.page.keyboard.up(keyboardCommand);
  }
}
