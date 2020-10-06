import ConceptDomainCard, {Domain} from 'app/component/concept-domain-card';
import DataResourceCard from 'app/component/data-resource-card';
import ConceptsetActionsPage from 'app/page/conceptset-actions-page';
import WorkspaceDataPage from 'app/page/workspace-data-page';
import {findWorkspace, signIn} from 'utils/test-utils';
import {waitForText} from 'utils/waits-utils';
import {ResourceCard} from 'app/text-labels';

describe('Create Concept Sets from Domains', () => {

  beforeEach(async () => {
    await signIn(page);
  });

  /**
   * Test:
   * - Create new Concept Set from Conditions domain.
   * - Delete Concept Set.
   */
  test('Create Concept Set from Conditions domain', async () => {
    const workspaceCard = await findWorkspace(page);
    await workspaceCard.clickWorkspaceName();

    // Click Add Datasets button.
    const dataPage = new WorkspaceDataPage(page);
    const datasetBuildPage = await dataPage.clickAddDatasetButton();

    // Click Add Concept Sets button.
    const conceptPage = await datasetBuildPage.clickAddConceptSetsButton();

    // Start: Add a Concept in Conditions domain
    const conditionDomainCard = await ConceptDomainCard.findDomainCard(page, Domain.Conditions);

    // In Conditions domain, both Concepts and Participants counts should be non-zero numberical digits.
    const conceptsCount = await conditionDomainCard.getConceptsCount();
    const conceptsCountInt = Number(conceptsCount.replace(/,/g, ''));
    expect(conceptsCountInt).toBeGreaterThan(1);

    const participantsCount = await conditionDomainCard.getParticipantsCount();
    const participantsCountInt = Number(participantsCount.replace(/,/g, ''));
    expect(participantsCountInt).toBeGreaterThan(1);

    await conditionDomainCard.clickSelectConceptButton();

    // Hardcode Concept Condition name and code for search and verify
    const conditionCode = '59621000';
    const conditionName = 'Essential hypertension';

    // Search by Code.
    await conceptPage.searchConcepts(conditionCode);
    const rowCells = await conceptPage.dataTableSelectRow();
    // Verify condition name from search result
    expect(rowCells.name).toBe(conditionName);

    await conceptPage.clickAddToSetButton();

    // Save
    const conceptName = await conceptPage.saveConcept();

    // Verify Concept Set created successfully.
    const successMessage = `Concept Set Saved Successfully`;
    const isSuccess = await waitForText(page, successMessage);
    expect(isSuccess).toBe(true);

    const linkExists = await waitForText(page, conceptName);
    expect(linkExists).toBe(true);
    console.log(`Created Concept Set "${conceptName}"`);

    // Delete Concept Set
    await dataPage.openConceptSetsSubtab();

    const modalTextContent = await dataPage.deleteResource(conceptName, ResourceCard.ConceptSet);
    expect(modalTextContent).toContain(`Are you sure you want to delete Concept Set: ${conceptName}?`);
  });

  /**
   * Test:
   * - Create new Concept Set from Drug Exposures domain.
   * - Create new Concept Set from Measurements domain.
   * - Create new Dataset using above two Concept Sets.
   * - Delete Dataset, Concept Set.
   */
  test('Create Concept Sets from Drug Exposures and Measurements domains', async () => {
    const workspaceCard = await findWorkspace(page);
    await workspaceCard.clickWorkspaceName();

    // Click Add Datasets button.
    const dataPage = new WorkspaceDataPage(page);
    const datasetBuildPage = await dataPage.clickAddDatasetButton();

    // Start: Create new Concept Set 1
    // Click Add Concept Sets button.
    const conceptSearchPage = await datasetBuildPage.clickAddConceptSetsButton();

    // Add new Concept in Drug Exposures domain
    const drugDomainCard = await ConceptDomainCard.findDomainCard(page, Domain.DrugExposures);

    // In Drug Exposures domain, both Concepts and Participants counts should be non-zero numberical digits.
    const conceptsCount = await drugDomainCard.getConceptsCount();
    const conceptsCountInt = Number(conceptsCount.replace(/,/g, ''));
    expect(conceptsCountInt).toBeGreaterThan(1);

    const participantsCount = await drugDomainCard.getParticipantsCount();
    const participantsCountInt = Number(participantsCount.replace(/,/g, ''));
    expect(participantsCountInt).toBeGreaterThan(1);

    await drugDomainCard.clickSelectConceptButton();

    // Hardcode drug name for search
    const drugName = 'Diphenhydramine';

    // Search by drug name
    await conceptSearchPage.searchConcepts(drugName);
    await conceptSearchPage.dataTableSelectAllRows();

    await conceptSearchPage.clickAddToSetButton();

    // Save
    const conceptName1 = await conceptSearchPage.saveConcept();
    console.log(`Created Concept Set "${conceptName1}"`);

    // Start: Create new Concept Set 2
    const conceptActionPage = new ConceptsetActionsPage(page);
    await conceptActionPage.clickCreateAnotherConceptSetButton();

    // Add new Concept in Measurements domain
    const measurementsDomainCard = await ConceptDomainCard.findDomainCard(page, Domain.Measurements);
    await measurementsDomainCard.clickSelectConceptButton();

    // Hardcode Measurements name for search
    const measurementName = 'Weight';

    // Search by drug name
    await conceptSearchPage.searchConcepts(measurementName);
    await conceptSearchPage.dataTableSelectAllRows();

    await conceptSearchPage.clickAddToSetButton();

    // Save
    const conceptName2 = await conceptSearchPage.saveConcept();
    console.log(`Created Concept Set "${conceptName2}"`);

    // Create new Dataset with two new Concept Sets
    await conceptActionPage.clickCreateDatasetButton();
    await datasetBuildPage.selectCohorts(['All Participants']);
    await datasetBuildPage.selectConceptSets([conceptName1, conceptName2]);
    const saveModal = await datasetBuildPage.clickSaveAndAnalyzeButton();
    const datasetName = await saveModal.saveDataset();

    // Verify Dataset created successful.
    await dataPage.openDatasetsSubtab();

    const resourceCard = new DataResourceCard(page);
    const dataSetExists = await resourceCard.cardExists(datasetName, ResourceCard.Dataset);
    expect(dataSetExists).toBe(true);

    // Delete Dataset.
    const textContent = await dataPage.deleteResource(datasetName, ResourceCard.Dataset);
    expect(textContent).toContain(`Are you sure you want to delete Dataset: ${datasetName}?`);

    // Delete Concept Set.
    await dataPage.openConceptSetsSubtab();

    await dataPage.deleteResource(conceptName1, ResourceCard.ConceptSet);
    await dataPage.deleteResource(conceptName2, ResourceCard.ConceptSet);
  });

});
