import BaseElement from 'app/element/base-element';
import CreateAccountPage from 'app/page/create-account-page';
import GoogleLoginPage from 'app/page/google-login';
import { config } from 'resources/workbench-config';
import { waitForText } from 'utils/waits-utils';

describe('Account creation UI tests:', () => {
  test('Can navigate the new user account creation workflow', async () => {
    const loginPage = new GoogleLoginPage(page);
    await loginPage.load();

    // Click the create account button to start the new user account creation flow.
    await loginPage.clickCreateAccountButton();

    const createAccountPage = new CreateAccountPage(page);
    // Step 1: Checking Accepting Terms of Service.
    expect(await createAccountPage.agreementLoaded()).toBe(true);

    // Before user read all pdf pages, checkboxes are unchecked and disabled
    const termsOfUseCheckbox = createAccountPage.getTermsOfUseCheckbox();
    expect(termsOfUseCheckbox).toBeTruthy();
    expect(await termsOfUseCheckbox.isDisabled()).toBe(true);
    expect(await termsOfUseCheckbox.isChecked()).toBe(false);

    let nextButton = createAccountPage.getNextButton();
    expect(await nextButton.isCursorNotAllowed()).toEqual(true);

    // scroll to last pdf file will enables checkbox
    await createAccountPage.readAgreement();
    expect(await termsOfUseCheckbox.isDisabled()).toBe(false);

    // check checkbox
    expect(await nextButton.isCursorNotAllowed()).toEqual(true);
    await createAccountPage.getTermsOfUseCheckbox().check();

    // verify checked
    expect(await termsOfUseCheckbox.isChecked()).toBe(true);
    expect(await nextButton.isCursorNotAllowed()).toEqual(false);

    // uncheck a checkbox then check NEXT button is again disabled
    await createAccountPage.getTermsOfUseCheckbox().unCheck();
    expect(await nextButton.isCursorNotAllowed()).toEqual(true);

    // check checkbox
    await createAccountPage.getTermsOfUseCheckbox().check();
    const agreementPageButton = createAccountPage.getNextButton();
    await agreementPageButton.clickWithEval();

    // Step 2 of 3: Enter Institution information
    nextButton = createAccountPage.getNextButton();
    expect(await nextButton.isCursorNotAllowed()).toEqual(true);

    await createAccountPage.fillOutInstitution();

    await nextButton.waitUntilEnabled();
    expect(await nextButton.isCursorNotAllowed()).toEqual(false);
    await nextButton.clickWithEval();

    // Step 3 of 3: Enter user information.
    await waitForText(page, 'Create your account');

    // verify username domain
    expect(await createAccountPage.getUsernameDomain()).toBe(config.EMAIL_DOMAIN_NAME);

    // verify all input fields are visible and editable on this page
    const allInputs = await page.$$('input');
    for (const aInput of allInputs) {
      const elem = BaseElement.asBaseElement(page, aInput);
      const isDisabled = await elem.isDisabled();
      expect(isDisabled).toBe(false);
      const value = await elem.getTextContent();
      expect(value).toBe(''); // empty value
      await elem.dispose();
    }

    // the NEXT button on User Information page should be disabled until all required fields are filled
    const userInforPageButton = createAccountPage.getNextButton();
    await userInforPageButton.isVisible();
    const cursor = await userInforPageButton.isCursorNotAllowed();
    expect(cursor).toEqual(true);
  });
});
