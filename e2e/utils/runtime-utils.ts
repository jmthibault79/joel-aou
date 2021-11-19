import { Page } from 'puppeteer';
import Button from 'app/element/button';

const Selector = {
  runtimeInitializerCreateButton: '//*[@role="dialog"]//*[text()="Create Environment" and @role="button"]'
};

export async function initializeRuntimeIfModalPresented(page: Page): Promise<void> {
  let initializeButton: Button;
  try {
    initializeButton = new Button(page, Selector.runtimeInitializerCreateButton);
    await initializeButton.waitUntilEnabled();
  } catch (e) {
    // Expected if the runtime already exists.
    return;
  }

  await initializeButton.clickAndWait();
}
