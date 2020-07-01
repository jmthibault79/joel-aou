import {Page} from 'puppeteer';
import {waitWhileLoading} from 'utils/test-utils';
import {waitForDocumentTitle} from 'utils/waits-utils';
import Textbox from 'app/element/textbox';
import DataTable from 'app/component/data-table';
import Button from 'app/element/button';
import AuthenticatedPage from './authenticated-page';
import ConceptsetSaveModal from './conceptset-save-modal';

const PageTitle = 'Search Concepts';

export default class ConceptsetSearchPage extends AuthenticatedPage{

  constructor(page: Page) {
    super(page);
  }

  async isLoaded(): Promise<boolean> {
    const searchTextbox = this.getSearchTextbox();
    try {
      await Promise.all([
        waitForDocumentTitle(this.page, PageTitle),
        searchTextbox.waitForXPath(),
        waitWhileLoading(this.page),
      ]);
      return true;
    } catch (e) {
      console.error(`ConceptsetSearchPage isLoaded() encountered ${e}`);
      return false;
    }
  }

  async saveConceptDialog(): Promise<string> {
    const dialog = new ConceptsetSaveModal(this.page);
    return dialog.saveAndCloseDialog();
  }

  async getAddToSetButton(): Promise<Button> {
    return new Button(this.page, '//*[@data-test-id="sliding-button"]');
  }

  async clickAddToSetButton(): Promise<void> {
    const addButton = await this.getAddToSetButton();
    await addButton.click();
    return waitWhileLoading(this.page);
  }

  async searchConcepts(searchKeywords: string): Promise<void> {
    const searchInput = this.getSearchTextbox();
    await searchInput.type(searchKeywords);
    await searchInput.pressReturn();
    return waitWhileLoading(this.page);
  }

  /**
   * Check Checkbox in specified row index
   * @param {number} rowIndex
   * @return {string} The Code value in same table row.
   */
  async dataTableSelectRow(rowIndex: number = 1): Promise<string> {
    const dataTable = this.getDataTable();
    const bodyTable = dataTable.getBodyTable();

    const codeCell = await bodyTable.getCell(rowIndex, 2);
    const textProp = await codeCell.getProperty('textContent');
    const cellTextContent = await textProp.jsonValue();
    const selectCheckCell = await bodyTable.getCell(rowIndex, 1);
    const elemt = (await selectCheckCell.$x('//*[@role="checkbox"]'))[0];
    await elemt.click();
    return cellTextContent.toString();
  }

  /**
   * Check Select All Checkbox in data table.
   */
  async dataTableSelectAllRows(): Promise<void> {
    const dataTable = this.getDataTable();
    const headerTable = dataTable.getHeaderTable();

    const selectCheckCell = await headerTable.getHeaderCell(1);
    const elemt = (await selectCheckCell.$x('//*[@role="checkbox"]'))[0];
    await elemt.click();
  }

  getDataTable(): DataTable {
    return new DataTable(this.page);
  }

  private getSearchTextbox(): Textbox {
    return new Textbox(this.page, '//input[@data-test-id="concept-search-input"]');
  }

}
