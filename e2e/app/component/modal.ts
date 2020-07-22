import Container from 'app/container';
import {Page} from 'puppeteer';
import Button from 'app/element/button';
import Textbox from 'app/element/textbox';
import Textarea from 'app/element/textarea';
import Checkbox from 'app/element/checkbox';
import {savePageToFile, takeScreenshot} from 'utils/save-file-utils';
import {LinkText} from 'app/text-labels';


const Selector = {
  defaultDialog: '//*[@role="dialog"]',
}

export default class Modal extends Container {

  constructor(page: Page, xpath: string = Selector.defaultDialog) {
    super(page, xpath);
  }

  async waitForLoad(): Promise<this> {
    try {
      await this.waitUntilVisible();
    } catch (e) {
      await savePageToFile(this.page);
      await takeScreenshot(this.page);
      const title = await this.page.title();
      throw new Error(`"${title}" modal waitForLoad() encountered ${e}`);
    }
    return this;
  }

  async getContent(): Promise<string> {
    const modal = await this.page.waitForXPath(this.xpath, {visible: true});
    const modalText = await (await modal.getProperty('innerText')).jsonValue();
    console.debug('Modal: \n' + modalText);
    return modalText.toString();
  }

  async clickButton(buttonLabel: LinkText): Promise<void> {
    const button = await this.waitForButton(buttonLabel);
    await button.waitUntilEnabled();
    return button.click();
  }

  async waitForButton(buttonLabel: LinkText): Promise<Button> {
    return Button.findByName(this.page, {normalizeSpace: buttonLabel}, this);
  }

  async waitForTextbox(textboxName: string): Promise<Textbox> {
    return Textbox.findByName(this.page, {name: textboxName}, this);
  }

  async waitForTextarea(textareaName: string): Promise<Textarea> {
    return Textarea.findByName(this.page, {name: textareaName}, this);
  }

  async waitForCheckbox(checkboxName: string): Promise<Checkbox> {
    return Checkbox.findByName(this.page, {name: checkboxName}, this);
  }

  async waitUntilClose(): Promise<void> {
    await this.page.waitForXPath(this.xpath, {hidden: true});
  }

  async waitUntilVisible(): Promise<void> {
    await this.page.waitForXPath(this.xpath, {visible: true});
  }

  /**
   * Returns true if Dialog exists on page.
   */
  async exists(): Promise<boolean> {
    return (await this.page.$x(this.xpath)).length > 0;
  }

}
