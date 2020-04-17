import {ElementHandle, Page} from 'puppeteer';
import {WorkspaceAccessLevel} from 'app/page-identifiers';
import BaseElement from 'app/aou-elements/base-element';
import EllipsisMenu from 'app/aou-elements/ellipsis-menu';
import * as fp from 'lodash/fp';


/**
 * WorkspaceCard represents workspace card user found on Home and All Workspaces pages.
 * A Workspace Card is element that contains a child element with attribute: @data-test-id='workspace-card'
 */
export default class WorkspaceCard extends BaseElement {

  static readonly popupRootXpath = '//*[@id="popup-root"]'; // element is not a child of workspace-card
  static readonly cardRootXpath = '//*[child::*[@data-test-id="workspace-card"]]';

  // **********************
  // static functions
  // **********************

  /**
   * Find all visible Workspace Cards. Assume at least one Card exists.
   * @param {Page} page
   * @throws TimeoutError if fails to find Card.
   */
  static async getAllCards(page: Page): Promise<WorkspaceCard[]> {
    await page.waitForXPath(WorkspaceCard.cardRootXpath, {visible: true, timeout: 60000});
    const cards = await page.$x(this.cardRootXpath);
    // transform to WorkspaceCard object
    const resourceCards = cards.map(card => new WorkspaceCard(page).asCardElement(card));
    return resourceCards;
  }

  static async getAnyCard(page: Page): Promise<WorkspaceCard> {
    const cards = await this.getAllCards(page);
    if (cards.length === 0) {
      throw new Error('FAILED to find any Workspace card on page.');
    }
    const anyCard = fp.shuffle(cards)[0];
    return anyCard;
  }

  static async findCard(page: Page, workspaceName: string): Promise<WorkspaceCard | null> {
    const selector = `.//*[@data-test-id="workspace-card-name" and text()="${workspaceName}"]`;
    const allCards = await this.getAllCards(page);
    for (const card of allCards) {
      const children = await card.asElementHandle().$x(selector);
      if (children.length > 0) {
        return card; // matched workspace name, found the Workspace card.
      }
      await card.dispose(); // not it, dispose the ElementHandle.
    }
    return null; // not found
  }


  constructor(page: Page) {
    super(page);
  }

  async getWorkspaceName(): Promise<unknown> {
    const selector = './/*[@data-test-id="workspace-card-name"]';
    const workspaceNameElemt = await this.element.$x(selector);
    const jHandle = await workspaceNameElemt[0].getProperty('innerText');
    const name = await jHandle.jsonValue();
    await jHandle.dispose();
    return name;
  }

  asElementHandle(): ElementHandle {
    return this.element.asElement();
  }

  async getEllipsis(): Promise<EllipsisMenu> {
    return new EllipsisMenu(this.page, './/clr-icon[@shape="ellipsis-vertical"]', this.asElementHandle());
  }

  /**
   * Find workspace access level.
   * @param workspaceName
   */
  async getWorkspaceAccessLevel() : Promise<unknown> {
    const element = await this.page.waitForXPath(this.accessLevelSelector(), {visible: true});
    return (await element.getProperty('innerText')).jsonValue();
  }

  /**
   * Find element with specified workspace name on the page.
   * @param {string} workspaceName
   */
  async getWorkspaceNameLink(workspaceName: string) : Promise<ElementHandle> {
    return this.page.waitForXPath(this.workspaceNameLinkSelector(workspaceName));
  }

  async getWorkspaceMatchAccessLevel(level: WorkspaceAccessLevel = WorkspaceAccessLevel.OWNER): Promise<WorkspaceCard[]> {
    const matchWorkspaceArray: WorkspaceCard[] = [];
    const allWorkspaceCards = await WorkspaceCard.getAllCards(page);
    for (const card of allWorkspaceCards) {
      const accessLevel = await card.getWorkspaceAccessLevel();
      if (accessLevel === level) {
        matchWorkspaceArray.push(card);
      }
    }
    return matchWorkspaceArray;
  }

  /**
   * Click Workspace Name in Workspace Card.
   */
  async clickWorkspaceName() {
    const elemt = await this.page.waitForXPath('//*[@data-test-id="workspace-card-name"]', {visible: true});
    await Promise.all([
      this.page.waitForNavigation({waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 60000}),
      elemt.click()
    ]);
  }

  private asCardElement(elementHandle: ElementHandle): WorkspaceCard {
    this.element = elementHandle;
    return this;
  }

  private accessLevelSelector() {
    return `.//*[@data-test-id='workspace-access-level']`;
  }

  private workspaceNameLinkSelector(workspaceName: string) {
    return `//*[@role='button'][./*[@data-test-id='workspace-card-name' and normalize-space(text())='${workspaceName}']]`
  }

}
