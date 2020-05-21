const PuppeteerEnvironment = require('jest-environment-puppeteer');
const fs = require('fs-extra');
const fp = require('lodash/fp');
require('jest-circus');

// jest-circus retryTimes
const retryTimes = 1;

class PuppeteerCustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();
  }

  async teardown() {
    // time for screenshots
    await this.global.page.waitFor(1000);
    await super.teardown();
  }

  // Take a screenshot right after failure
  async handleTestEvent(event, state) {
    switch (event.name) {
    case 'test_fn_failure':
      if (state.currentlyRunningTest.invocations > retryTimes) {
        console.error(`Failed test:  "${event.test.name}"`);
        const testName = fp.startCase(state.currentlyRunningTest.name).replace(/[^A-Z0-9]+/ig, '');
        const screenshotDir = 'logs/screenshot';
        await fs.ensureDir(screenshotDir);
          // move create-filename to helper.ts
        const timestamp = new Date().getTime();
        const fileName = `${testName}_${timestamp}.png`;

        const screenshotFile = `${screenshotDir}/${fileName}`;
        await this.global.page.screenshot({path: screenshotFile, fullPage: true});
        console.error(`Saved screenshot ${screenshotFile}`);

        const htmlFileName = `${testName}_${timestamp}.html`;
        await this.savePageToFile(htmlFileName);
      }
      break;
    default:
      break;
    }
  }

  async savePageToFile(fileName) {
    const logDir = 'logs/html';
    await fs.ensureDir(logDir);
    const htmlFile = `${logDir}/${fileName}`;
    const htmlContent = await this.global.page.content();
    return new Promise((resolve, reject) => {
      fs.writeFile(htmlFile, htmlContent, 'utf8', error => {
        if (error) {
          console.error(`Failed to save html file. ` + error);
          reject(false);
        } else {
          console.log('Saved html file ' + htmlFile);
          resolve(true);
        }
      })
    });
  }

}

module.exports = PuppeteerCustomEnvironment;
