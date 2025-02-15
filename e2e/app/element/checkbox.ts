import { Page } from 'puppeteer';
import Container from 'app/container';
import { ElementType, XPathOptions } from 'app/xpath-options';
import BaseElement from './base-element';
import { buildXPath } from 'app/xpath-builders';
import { logger } from 'libs/logger';

export default class Checkbox extends BaseElement {
  static findByName(page: Page, xOpt: XPathOptions, container?: Container): Checkbox {
    xOpt.type = ElementType.Checkbox;
    const checkboxXpath = buildXPath(xOpt, container);
    const checkbox = new Checkbox(page, checkboxXpath);
    return checkbox;
  }

  constructor(page: Page, xpath?: string) {
    super(page, xpath);
  }

  /**
   * Checked means element does not have "checked" property.
   */
  async isChecked(): Promise<boolean> {
    return this.getProperty<boolean>('checked');
  }

  /**
   * Click (check) checkbox element.
   */
  async check(maxAttempts = 2): Promise<void> {
    const click = async () => {
      await this.clickWithEval();
      const isChecked = await this.isChecked();
      if (isChecked) {
        return;
      }
      if (maxAttempts <= 0) {
        return;
      }
      maxAttempts--;
      await this.page.waitForTimeout(1000).then(click); // 1 second pause then try again
    };
    const checked = await this.isChecked();
    if (!checked) {
      await click();
    }
  }

  /**
   * Click on checkbox element for unchecked
   */
  async unCheck(): Promise<void> {
    const is = await this.isChecked();
    if (is) {
      await this.focus();
      await this.clickWithEval();
    }
  }

  /**
   * Toggle checkbox state.
   * @param {boolean} checked
   */
  async toggle(checked?: boolean): Promise<void> {
    if (checked === undefined) {
      return this.clickWithEval();
    }
    if (checked) {
      return this.check();
    }
    return this.unCheck();
  }

  // Override waitUntilEnabled in base-element.ts
  // Web element property disabled is used to determine state (enabled/disabled) of checkbox
  async waitUntilEnabled(xpathSelector?: string): Promise<void> {
    const selector = xpathSelector || this.getXpath();
    const propertyName = 'disabled';
    const propertyValue = false;
    await this.page.waitForXPath(this.getXpath(), { visible: true });
    await this.page
      .waitForFunction(
        (xpath, property, value) => {
          const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
            .singleNodeValue;
          const attrValue = Boolean((element as Element).getAttribute(property));
          return value === attrValue;
        },
        {},
        selector,
        propertyName,
        propertyValue
      )
      .catch((err) => {
        logger.error(`waitUntilEnabled() failed: ${propertyName}: ${propertyValue}.  XPath=${selector}`);
        logger.error(err);
        throw new Error(err);
      });
  }
}
