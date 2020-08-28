import DataResourceCard, {CardType} from 'app/component/data-resource-card';
import Modal from 'app/component/modal';
import DataPage, {TabLabelAlias} from 'app/page/data-page';
import NotebookPreviewPage from 'app/page/notebook-preview-page';
import {LinkText} from 'app/text-labels';
import {extractNamespace, makeRandomName} from 'utils/str-utils';
import {findWorkspace, signIn} from 'utils/test-utils';

// Notebook server start may take a long time. Set maximum test running time to 20 minutes.
jest.setTimeout(20 * 60 * 1000);

describe('Workspace owner Jupyter notebook action tests', () => {

  beforeEach(async () => {
    await signIn(page);
  });

  /**
   * Test:
   * - Create new Workspace as the copy-to destination Workspace.
   * - Create new Workspace as copy-from Workspace and create new notebook in this Workspace.
   * - Run code to print WORKSPACE_NAMESPACE. It should match Workspace namespace from Workspace URL.
   * - Copy notebook to destination Workspace and give copied notebook a new name.
   * - Verify copied notebook is in destination Workspace.
   * - Open copied notebook and run code to print WORKSPACE_NAMESPACE. It should match destination Workspace namespace.
   * - Delete notebooks.
   */
  test('Copy notebook to another Workspace', async () => {
    // Create destination workspace
    const toWorkspace = await findWorkspace(page, {create: true}).then(card => card.getWorkspaceName());

    // Create copy-from workspace
    await findWorkspace(page, {create: true}).then(card => card.clickWorkspaceName());

    // Create notebook in copy-from workspace.
    const copyFromNotebookName = makeRandomName('pytest');
    const dataPage = new DataPage(page);

    // Get the billing project name from page url.
    const fromWorkspaceNamespace = extractNamespace(new URL(page.url()));

    const copyFromNotebookPage = await dataPage.createNotebook(copyFromNotebookName);

    // Run code to print out Workspace namespace.
    const code =
       'import os\n' +
       'print(os.getenv(\'WORKSPACE_NAMESPACE\'))';

    const codeOutput1 = await copyFromNotebookPage.runCodeCell(1, {code});
    expect(codeOutput1).toEqual(fromWorkspaceNamespace);

    // Exit notebook and returns to the Workspace Analysis tab.
    const analysisPage = await copyFromNotebookPage.goAnalysisPage();

    // Copy to destination Workspace and give notebook a new name.
    const copiedNotebookName = makeRandomName('copy-of');
    await analysisPage.copyNotebookToWorkspace(copyFromNotebookName, toWorkspace, copiedNotebookName);

    // Verify Copy Success modal.
    const modal = new Modal(page);
    await modal.waitForButton(LinkText.GoToCopiedNotebook);
    const textContent = await modal.getTextContent();
    const successMsg = `Successfully copied ${copyFromNotebookName}  to ${toWorkspace} . Do you want to view the copied Notebook?`;
    expect(textContent).toContain(successMsg);
    // Dismiss modal.
    await modal.clickButton(LinkText.StayHere, {waitForClose: true});

    // Delete notebook
    const deleteModalTextContent = await analysisPage.deleteNotebook(copyFromNotebookName);
    expect(deleteModalTextContent).toContain(`Are you sure you want to delete Notebook: ${copyFromNotebookName}?`);

    // Perform actions in copied notebook.
    // Open destination Workspace
    await findWorkspace(page, {workspaceName: toWorkspace}).then(card => card.clickWorkspaceName());
    // Get the destination Workspace namespace.
    const toWorkspaceNamespace = extractNamespace(new URL(page.url()));

    // Verify copy-to notebook exists in destination Workspace
    await dataPage.openTab(TabLabelAlias.Analysis);
    const dataResourceCard = new DataResourceCard(page);
    const notebookCard = await dataResourceCard.findCard(copiedNotebookName, CardType.Notebook);
    expect(notebookCard).toBeTruthy();

    // Open copied notebook and run code to verify billing project name.
    await notebookCard.clickResourceName();
    const notebookPreviewPage = new NotebookPreviewPage(page);
    await notebookPreviewPage.waitForLoad();
    const copyNotebookPage = await notebookPreviewPage.openEditMode(copiedNotebookName);

    // Run same code and compare namespace.
    const codeOutput2 = await copyNotebookPage.runCodeCell(-1, {code});
    expect(codeOutput2).toEqual(toWorkspaceNamespace);

    // Exit notebook. Returns to the Workspace Analysis tab.
    await copyNotebookPage.goAnalysisPage();
    // Delete notebook
    const modalTextContent = await analysisPage.deleteNotebook(copiedNotebookName);
    expect(modalTextContent).toContain('This will permanently delete the Notebook.');
  })

});
