import {Domain} from 'app/component/concept-domain-card';
import DataResourceCard from 'app/component/data-resource-card';
import WorkspaceCard from 'app/component/workspace-card';
import ConceptsetActionsPage from 'app/page/conceptset-actions-page';
import ConceptsetPage from 'app/page/conceptset-page';
import {SaveOption} from 'app/page/conceptset-save-modal';
import WorkspaceDataPage from 'app/page/workspace-data-page';
import {LinkText, ResourceCard} from 'app/text-labels';
import {makeRandomName} from 'utils/str-utils';
import {findWorkspace, signIn} from 'utils/test-utils';


describe('Copy Concept Set to another workspace', () => {

  beforeEach(async () => {
    await signIn(page);
  });

  /**
   * Test:
   * - Copy Concept Set from one workspace to another workspace.
   */
  test('Workspace OWNER can copy Concept Set', async () => {

    // Need a source and a destination workspace.

    const destWorkspaceCard: WorkspaceCard = await findWorkspace(page, {create: true});
    const destWorkspace = await destWorkspaceCard.getWorkspaceName();

    const srcWorkspaceCard: WorkspaceCard = await findWorkspace(page, {create: true});
    const srcWorkspace = await srcWorkspaceCard.getWorkspaceName();

    // Open Source Workspace Data Page.
    await srcWorkspaceCard.clickWorkspaceName();
    // Open Concept Sets tab.
    const dataPage = new WorkspaceDataPage(page);
    await dataPage.openConceptSetsSubtab();

    // Create new Concept Set
    const conceptSearchPage = await dataPage.openConceptSearch(Domain.Procedures);
    await conceptSearchPage.dataTableSelectAllRows();
    const addButtonLabel = await conceptSearchPage.clickAddToSetButton();
    // Table pagination displays 20 rows. If this changes, then update the check below.
    expect(addButtonLabel).toBe('Add (20) to set');
    const conceptName = await conceptSearchPage.saveConcept(SaveOption.CreateNewSet);
    console.log(`Created Concept Set: "${conceptName}"`);
    // Click on link to open Concept Set page.
    const conceptsetActionPage = new ConceptsetActionsPage(page);
    await conceptsetActionPage.openConceptSet(conceptName);

    // Concept Set page is open.
    const conceptsetPage = new ConceptsetPage(page);
    await conceptsetPage.waitForLoad();

    // Copy Concept Set to another workspace with new Concept name.
    const conceptSetCopyName = makeRandomName();

    const conceptCopyModal = await conceptsetPage.openCopyToWorkspaceModal(conceptName);
    await conceptCopyModal.copyToAnotherWorkspace(destWorkspace, conceptSetCopyName);

    // Click "Go to Copied Concept Set" button.
    await conceptCopyModal.waitForButton(LinkText.GoToCopiedConceptSet).then(butn => butn.click());

    await dataPage.waitForLoad();

    // Verify destWorkspace is open.
    const url = page.url();
    expect(url).toContain(destWorkspace.replace(/-/g, ''));

    const resourceCard = new DataResourceCard(page);
    const exists = await resourceCard.cardExists(conceptSetCopyName, ResourceCard.ConceptSet);
    expect(exists).toBe(true);

    console.log(`Copied Concept Set: "${conceptName} from workspace: "${srcWorkspace}" to Concept Set: "${conceptSetCopyName}" in another workspace: "${destWorkspace}"`)

    // Delete Concept Set in destWorkspace.
    await dataPage.deleteResource(conceptSetCopyName, ResourceCard.ConceptSet);
  });


});
