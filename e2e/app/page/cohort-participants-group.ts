import {ElementHandle, Page} from 'puppeteer';
import {FieldSelector} from 'app/page/cohort-build-page';
import Modal from 'app/component/modal';
import EllipsisMenu from 'app/component/ellipsis-menu';
import {waitForNumericalString, waitForText} from 'utils/waits-utils';
import CohortSearchPage, {FilterSign, PhysicalMeasurementsCriteria} from 'app/page/cohort-search-page';
import TieredMenu from 'app/component/tiered-menu';
import {waitWhileLoading} from 'utils/test-utils';
import {LinkText} from 'app/text-labels';

export enum GroupAction {
   EditGroupName  = 'Edit group name',
   SuppressGroupFromTotalCount = 'Suppress group from total count',
   DeleteGroup = 'Delete group',
}

export default class CohortParticipantsGroup {

  private rootXpath: string;

  constructor(private readonly page: Page) {

  }

  setXpath(xpath: string): void {
    this.rootXpath = xpath;
  }

  async exists(): Promise<boolean> {
    return (await this.page.$x(this.rootXpath)).length > 0;
  }

  getAddCriteriaButtonXpath(): string {
    return `${this.rootXpath}/ancestor::node()[1]/*[normalize-space()="Add Criteria"]/button`;
  }

  getGroupCountXpath(): string {
    return `${this.rootXpath}/ancestor::node()[1]${FieldSelector.GroupCount}`;
  }

  getGroupEllipsisMenu(): EllipsisMenu {
    const ellipsisXpath = `${this.rootXpath}//clr-icon[@shape="ellipsis-vertical"]`;
    return new EllipsisMenu(this.page, ellipsisXpath);
  }

   /**
    * Update Group name.
    * @param {string} newGroupName
    * @return {boolean} Returns TRUE if rename was successful.
    */
  async editGroupName(newGroupName: string): Promise<void> {
    const menu = this.getGroupEllipsisMenu();
    await menu.clickParticipantsGroupAction(GroupAction.EditGroupName);
    const modal = new Modal(this.page);
    const textbox = await modal.waitForTextbox('New Name:');
    await textbox.type(newGroupName);
    await modal.clickButton(LinkText.Rename, {waitForClose: true});
  }

  /**
   * Delete Group.
   * @return Returns array of criterias in this group.
   */
  async deleteGroup(): Promise<ElementHandle[]> {
    const menu = this.getGroupEllipsisMenu();
    await menu.clickParticipantsGroupAction(GroupAction.DeleteGroup);
    await waitForText(this.page, 'This group has been deleted');
    await waitWhileLoading(this.page);
    return this.getGroupCriteriasList();
  }

  async includePhysicalMeasurement(criteriaName: PhysicalMeasurementsCriteria, value: number): Promise<string> {
    await this.clickCriteriaMenuItems(['Physical Measurements']);
    const searchPage = new CohortSearchPage(this.page);
    await searchPage.waitForLoad();
    return searchPage.filterPhysicalMeasurementValue(criteriaName, FilterSign.GreaterThanOrEqualTo, value);
  }

  async includeDemographicsDeceased(): Promise<string> {
    await this.clickCriteriaMenuItems(['Demographics', 'Deceased']);
    return this.getGroupCount();
  }

  async includeConditions(): Promise<CohortSearchPage> {
    await this.clickCriteriaMenuItems(['Conditions']);
    const searchPage = new CohortSearchPage(this.page);
    await searchPage.waitForLoad();
    return searchPage;
  }

  async includeDrugs(): Promise<CohortSearchPage> {
    await this.clickCriteriaMenuItems(['Drugs']);
    const searchPage = new CohortSearchPage(this.page);
    await searchPage.waitForLoad();
    return searchPage;
  }

  async includeEthnicity(): Promise<CohortSearchPage> {
    await this.clickCriteriaMenuItems(['Demographics', 'Ethnicity']);
    const searchPage = new CohortSearchPage(this.page);
    await searchPage.waitForLoad();
    return searchPage;
  }

  async getGroupCount(): Promise<string> {
    return waitForNumericalString(this.page, this.getGroupCountXpath());
  }

  async includeAge(minAge: number, maxAge: number): Promise<string> {
    await this.clickCriteriaMenuItems(['Demographics', 'Age']);
    const searchPage = new CohortSearchPage(this.page);
    await searchPage.waitForLoad();
    const results = await searchPage.addAge(minAge, maxAge);
    await waitWhileLoading(this.page);
    return results;
  }

  async includeVisits(): Promise<CohortSearchPage> {
    await this.clickCriteriaMenuItems(['Visits']);
    const searchPage = new CohortSearchPage(this.page);
    await searchPage.waitForLoad();
    return searchPage;
  }

  private async clickCriteriaMenuItems(menuItemLinks: string[]): Promise<void> {
    const menu = await this.openTieredMenu();
    await menu.clickMenuItem(menuItemLinks);
  }

  private async openTieredMenu(): Promise<TieredMenu> {
    const addCriteriaButton = await this.page.waitForXPath(this.getAddCriteriaButtonXpath(), {visible: true});
    await addCriteriaButton.click(); // Click dropdown trigger to open menu
    return new TieredMenu(this.page);
  }

  async getGroupCriteriasList(): Promise<ElementHandle[]> {
    const selector = `${this.rootXpath}//*[@data-test-id="item-list"]`;
    return this.page.$x(selector);
  }

}
