import {Page} from 'puppeteer';
import Dialog from 'app/component/dialog';
import TieredMenu from 'app/component/tiered-menu';
import Button from 'app/element/button';
import ClrIconLink from 'app/element/clr-icon-link';
import {ElementType} from 'app/xpath-options';
import {makeRandomName} from 'utils/str-utils';
import {waitWhileLoading} from 'utils/test-utils';
import {waitForDocumentTitle, waitForNumericalString} from 'utils/waits-utils';
import {xPathOptionToXpath} from 'app/element/xpath-defaults';
import {LinkText} from 'app/page-identifiers';
import AuthenticatedPage from './authenticated-page';
import CohortParticipantsGroup from './cohort-participants-group';

const faker = require('faker/locale/en_US');
const PageTitle = 'Build Cohort Criteria';


export enum FieldSelector {
   TotalCount = '//*[contains(normalize-space(text()), "Total Count")]/parent::*//span',
   GroupCount = '//*[contains(normalize-space(text()), "Group Count")]/parent::*//span',
}

export default class CohortBuildPage extends AuthenticatedPage {

  constructor(page: Page) {
    super(page);
  }

  async isLoaded(): Promise<boolean> {
    try {
      await Promise.all([
        waitForDocumentTitle(this.page, PageTitle),
        waitWhileLoading(this.page),
      ]);
      return true;
    } catch (e) {
      console.log(`CohortBuildPage isLoaded() encountered ${e}`);
      return false;
    }
  }

  /**
   * Save Cohort changes.
   */
  async saveChanges(): Promise<void> {
    const createCohortButton = await Button.findByName(this.page, {normalizeSpace: LinkText.SaveCohort});
    await createCohortButton.waitUntilEnabled();
    await createCohortButton.click(); // Click dropdown trigger to open menu
    const menu =  new TieredMenu(this.page);
    await menu.clickMenuItem(['Save']);
    return waitWhileLoading(this.page);
  }

  async saveCohortAs(cohortName?: string, description?: string): Promise<string> {
    const createCohortButton = this.getCreateCohortButton();
    await createCohortButton.waitUntilEnabled();
    await createCohortButton.click();

    if (cohortName === undefined) {
      cohortName = makeRandomName();
    }
    if (description === undefined) {
      description = faker.lorem.words(10);
    }

    const dialog = new Dialog(this.page);
    const nameTextbox = await dialog.waitForTextbox('COHORT NAME');
    await nameTextbox.type(cohortName);

    const descriptionTextarea = await dialog.waitForTextarea('DESCRIPTION');
    await descriptionTextarea.type(description);

    const saveButton = await Button.findByName(this.page, {name: LinkText.Save});
    await saveButton.waitUntilEnabled();
    await saveButton.click();
    await dialog.waitUntilDialogIsClosed();
    await waitWhileLoading(this.page);

    return cohortName;
  }

  async deleteCohort(): Promise<string> {
    const saveButton = this.getSaveCohortButton();
    await saveButton.waitUntilEnabled();
    await this.getDeleteButton().then(b => b.click());
    return this.deleteConfirmationDialog();
  }

  /**
   * Click DELETE COHORT button in Cohort Delete Confirmation dialog.
   * @return {string} Dialog textContent.
   */
  async deleteConfirmationDialog(): Promise<string> {
    const dialog = new Dialog(this.page);
    const contentText = await dialog.getContent();
    const deleteButton = await Button.findByName(this.page, {normalizeSpace: LinkText.DeleteCohort}, dialog);
    await Promise.all([
      deleteButton.click(),
      dialog.waitUntilDialogIsClosed(),
    ]);
    await waitWhileLoading(this.page);
    return contentText;
  }

  /**
   * Click DISCARD CHANGES button in Confirmation dialog.
   * @return {string} Dialog textContent.
   */
  async discardChangesConfirmationDialog(): Promise<string> {
    const dialog = new Dialog(this.page);
    const contentText = await dialog.getContent();
    const deleteButton = await Button.findByName(this.page, {normalizeSpace: LinkText.DiscardChanges}, dialog);
    await Promise.all([
      deleteButton.click(),
      dialog.waitUntilDialogIsClosed(),
      this.page.waitForNavigation({waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 60000}),
    ]);
    await waitWhileLoading(this.page);
    return contentText;
  }

  /**
   * Find the Cohort Total Count.
   * This function also can be used to wait until participants calculation has completed.
   * @return {string} Total Count.
   */
  async getTotalCount(): Promise<string> {
    return waitForNumericalString(this.page, FieldSelector.TotalCount);
  }

  getSaveCohortButton(): Button {
    const xpath = xPathOptionToXpath({type: ElementType.Button, normalizeSpace: LinkText.SaveCohort});
    return new Button(this.page, xpath);
  }

  getCreateCohortButton(): Button {
    const xpath = xPathOptionToXpath({type: ElementType.Button, normalizeSpace: LinkText.CreateCohort});
    return new Button(this.page, xpath);
  }

  /**
   * Find DELETE (trash icon) button in Cohort Build page.
   * @return {ClrIconLink}
   */
  async getDeleteButton(): Promise<ClrIconLink> {
    return ClrIconLink.findByName(this.page, {iconShape: 'trash'});
  }

  /**
   * Find EXPORT button in Cohort Build page.
   */
  async getExportButton(): Promise<ClrIconLink> {
    return ClrIconLink.findByName(this.page, {iconShape: 'export'});
  }

  /**
   * Find COPY button in Cohort Build page.
   */
  async getCopyButton(): Promise<ClrIconLink> {
    return ClrIconLink.findByName(this.page, {iconShape: 'copy'});
  }

  /**
   * Include Participants Group.
   * @param groupName
   */
  findIncludeParticipantsGroup(groupName: string): CohortParticipantsGroup {
    const group = new CohortParticipantsGroup(this.page);
    group.setXpath(`//*[@id="list-include-groups"]//*[normalize-space()="${groupName}"]`);
    return group;
  }

  findExcludeParticipantsGroup(groupName: string): CohortParticipantsGroup {
    const group = new CohortParticipantsGroup(this.page);
    group.setXpath(`//*[@id="list-exclude-groups"]//*[normalize-space()="${groupName}"]`);
    return group;
  }

}
