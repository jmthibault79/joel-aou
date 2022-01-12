import * as fp from 'lodash/fp';
import { ElementHandle, Page } from 'puppeteer';
import { getPropValue } from 'utils/element-utils';
import { waitWhileLoading } from 'utils/waits-utils';
import Container from 'app/container';
import Button from 'app/element/button';
import Checkbox from 'app/element/checkbox';
import Textarea from 'app/element/textarea';
import Textbox from 'app/element/textbox';
import { LinkText } from 'app/text-labels';

const modalRootXpath = '//*[@id="popup-root"]/*[@class="ReactModalPortal"]';
const modalXpath = '//*[@role="dialog" and @aria-modal="true" and contains(@class, "after-open")]';

export default abstract class BaseModal extends Container {
  protected constructor(page: Page, opts: { xpath?: string; modalIndex?: number } = { modalIndex: 1 }) {
    super(page, opts.xpath ? opts.xpath : `${modalRootXpath}[${opts.modalIndex}]${modalXpath}`);
  }

  /**
   * Method to be implemented by children classes.
   * Check whether current page has specified web elements.
   */
  abstract isLoaded(): Promise<boolean>;

  async waitForLoad(): Promise<this> {
    const timeout = 30000;
    await this.waitUntilVisible(timeout);
    await this.isLoaded();
    await waitWhileLoading(this.page);
    return this;
  }

  async getTextContent(): Promise<string[]> {
    // xpath that excludes button labels and spans
    const selector = `${this.getXpath()}//div[normalize-space(text()) and not(@role="button")]`;
    await this.page.waitForXPath(selector, { visible: true });
    const elements: ElementHandle[] = await this.page.$x(selector);
    return fp.flow(
      fp.map(async (elem: ElementHandle) => (await getPropValue<string>(elem, 'innerText')).trim()),
      (contents) => Promise.all(contents)
    )(elements);
  }

  async getTitle(): Promise<string> {
    return (await this.getTextContent())[0];
  }

  waitForButton(buttonLabel: LinkText): Button {
    return Button.findByName(this.page, { normalizeSpace: buttonLabel }, this);
  }

  waitForTextbox(textboxName: string): Textbox {
    return Textbox.findByName(this.page, { name: textboxName }, this);
  }

  waitForTextarea(textareaName: string): Textarea {
    return Textarea.findByName(this.page, { name: textareaName }, this);
  }

  waitForCheckbox(checkboxName: string): Checkbox {
    return Checkbox.findByName(this.page, { name: checkboxName }, this);
  }

  /**
   * Returns true if Dialog exists on page.
   */
  async exists(): Promise<boolean> {
    return (await this.page.$x(this.xpath)).length > 0;
  }
}
