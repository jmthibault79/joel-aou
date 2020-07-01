import SelectMenu from 'app/component/select-menu';
import Button from 'app/element/button';
import Checkbox from 'app/element/checkbox';
import ClrIconLink from 'app/element/clr-icon-link';
import Textarea from 'app/element/textarea';
import Textbox from 'app/element/textbox';
import {findIframe} from 'app/xpath-finder';
import BasePage from 'app/page/base-page';
import {ElementType} from 'app/xpath-options';
import {Frame, Page} from 'puppeteer';
import {defaultFieldValues} from 'resources/data/user-registration-data';
import {config} from 'resources/workbench-config';
import {waitWhileLoading} from 'utils/test-utils';
import {waitForText} from 'utils/waits-utils';
import {LinkText} from 'app/text-labels';

const faker = require('faker/locale/en_US');

export const InstitutionSelectValue = {
  Vanderbilt: 'Vanderbilt University Medical Center',
  Broad: 'Broad Institute',
  Verily: 'Verily LLC',
  NationalInstituteHealth: 'National Institute of Health',
  Wondros: 'Wondros'
};

export const InstitutionRoleSelectValue = {
  EarlyCareerTenureTrackResearcher: 'Early career tenure-track researcher',
  UndergraduteStudent: 'Undergraduate (Bachelor level) student',
  Industry: 'Industry',
  ResearchAssistant: 'Research Assistant (pre-doctoral)',
  ResearchAssociate: 'Research associate (post-doctoral; early/mid career)',
  SeniorResearcher: 'Senior Researcher (PI/Team Lead, senior scientist)',
};

export const EducationLevelValue = {
  Doctorate: 'Doctorate',
  // other option values here
};

export const LabelAlias = {
  InstitutionName: 'Institution Name',
  AreYouAffiliated: 'Are you affiliated with an Academic Research Institution',
  ResearchBackground: 'Your research background, experience, and research interests',
  EducationLevel: 'Highest Level of Education Completed', // Highest Level of Education Completed
  YearOfBirth: 'Year of Birth',
  InstitutionEmail: 'Your institutional email address',
};

export const FieldSelector = {
  InstitutionEmailTextbox: {
    textOption: {
      containsText: LabelAlias.InstitutionEmail, ancestorLevel: 2
    }
  },
  EducationLevelSelect: {
    textOption: {
      type: ElementType.Dropdown, name: LabelAlias.EducationLevel, ancestorLevel: 2
    }
  },
  BirthYearSelect: {
    textOption: {
      type: ElementType.Dropdown, name: LabelAlias.YearOfBirth, ancestorLevel: 2
    }
  },
  InstitutionSelect: {
    textOption: {
      type:ElementType.Dropdown, name:'Select your institution', ancestorLevel:2
    }
  },
  DescribeRole: {
    textOption: {
      type: ElementType.Dropdown, containsText: 'describes your role', ancestorLevel: 2
    }
  }
};

export default class CreateAccountPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  async isLoaded(): Promise<boolean> {
    try {
      await Promise.all([
        waitForText(this.page, 'Please read through the entire agreement to continue'),
        this.page.waitForXPath('//*[@data-test-id="account-creation-tos"]', {visible: true}),
      ])
      return true;
    } catch (err) {
      console.log(`CreateAccountPage isLoaded() encountered ${err}`);
      return false;
    }
  }

  async getSubmitButton(): Promise<Button> {
    return await Button.findByName(this.page, {name: LinkText.Submit});
  }

  async getNextButton(): Promise<Button> {
    return await Button.findByName(this.page, {name: LinkText.Next});
  }

  async agreementLoaded(): Promise<boolean> {
    const iframe = await findIframe(this.page, 'terms of service agreement');
    const bodyHandle = await iframe.$('body');
    return await iframe.evaluate(body => body.scrollHeight > 0, bodyHandle);
  }

  async readAgreement(): Promise<Frame> {
    const iframe = await findIframe(this.page, 'terms of service agreement');
    const bodyHandle = await iframe.$('body');
    await iframe.evaluate(body =>  body.scrollTo(0, body.scrollHeight), bodyHandle);
    return iframe;
  }

  getPrivacyStatementCheckbox(): Checkbox {
    const selector = '//*[@id=//label[contains(normalize-space(), "All of Us Program Privacy Statement")]/@for]';
    return new Checkbox(this.page, selector);
  }

  getTermsOfUseCheckbox(): Checkbox {
    const selector = '//*[@id=//label[contains(normalize-space(), "Terms of Use")]/@for]';
    return new Checkbox(this.page, selector);
  }

  async getInstitutionNameInput(): Promise<Textbox> {
    return await Textbox.findByName(this.page, {name: LabelAlias.InstitutionName});
  }

  async getResearchBackgroundTextarea(): Promise<Textarea> {
    return await Textarea.findByName(this.page, {normalizeSpace: LabelAlias.ResearchBackground});
  }

  async getUsernameDomain(): Promise<unknown> {
    const elem = await this.page.waitForXPath('//*[./input[@id="username"]]/i');
    return await (await elem.getProperty('innerText')).jsonValue();
  }

  async fillInFormFields(fields: { label: string; value: string; }[]): Promise<string> {
    let newUserName;
    for (const field of fields) {
      const textbox = await Textbox.findByName(this.page, {name: field.label});
      await textbox.type(field.value);
      await textbox.pressTab();
      if (field.label === 'New Username') {
        await ClrIconLink.findByName(this.page, {name: field.label, iconShape: 'success-standard'});
        newUserName = field.value; // store new username for return
      }
    }
    return newUserName;
  }

  // select Institution Affiliation from a dropdown
  async selectInstitution(selectTextValue: string) {
    const dropdown = await SelectMenu.findByName(this.page, FieldSelector.InstitutionSelect.textOption);
    await dropdown.clickMenuItem(selectTextValue);
  }

  async getInstitutionValue() {
    const dropdown = await SelectMenu.findByName(this.page, FieldSelector.InstitutionSelect.textOption);
    return await dropdown.getSelectedValue();
  }

  // select Education Level from a dropdown
  async selectEducationLevel(selectTextValue: string) {
    const dropdown = await SelectMenu.findByName(this.page, FieldSelector.EducationLevelSelect.textOption);
    await dropdown.clickMenuItem(selectTextValue);
  }

  // select Year of Birth from a dropdown
  async selectYearOfBirth(year: string) {
    const dropdown = await SelectMenu.findByName(this.page, FieldSelector.BirthYearSelect.textOption);
    await dropdown.clickMenuItem(year);
  }

  // Combined steps to make test code cleaner and shorter

  // Step 1: Fill out institution affiliation details
  async fillOutInstitution() {
    await Promise.all([
      waitForText(this.page, 'complete Step 1 of 3', {css: 'body'}, 60000),
      waitWhileLoading(this.page, 60000),
    ]);

    await this.selectInstitution(InstitutionSelectValue.Broad);
    await this.getInstitutionValue();
    const emailAddressTextbox = await Textbox.findByName(this.page, FieldSelector.InstitutionEmailTextbox.textOption);
    await emailAddressTextbox.type(config.institutionContactEmail);
    await emailAddressTextbox.pressTab(); // tab out to start email validation
    await ClrIconLink.findByName(this.page, {containsText: LabelAlias.InstitutionEmail, ancestorLevel: 2, iconShape: 'success-standard'});

    const roleSelect = await SelectMenu.findByName(this.page, FieldSelector.DescribeRole.textOption);
    await roleSelect.clickMenuItem(InstitutionRoleSelectValue.UndergraduteStudent);
  }

  // Step 3: Accepting Terms of Use and Privacy statement.
  async acceptTermsOfUseAgreement() {
    const privacyStatementCheckbox = this.getPrivacyStatementCheckbox();
    const termsOfUseCheckbox = this.getTermsOfUseCheckbox();

    await this.readAgreement();

    // check by click on label works
    await privacyStatementCheckbox.check();
    await termsOfUseCheckbox.check();
  }

  // Step 3: Fill out user information with default values
  async fillOutUserInformation() {
    const newUserName = await this.fillInFormFields(defaultFieldValues);
    await (await this.getResearchBackgroundTextarea()).type(faker.lorem.word());
    return newUserName;
  }

  // Step 4: Fill out demographic survey information with default values
  async fillOutDemographicSurvey() {
    await waitForText(this.page, 'Optional Demographics Survey');
    // Find and check on all checkboxes with same label: Prefer not to answer
    const targetXpath = '//*[normalize-space(text())="Prefer not to answer"]/ancestor::node()[1]/input[@type="checkbox"]';
    await this.page.waitForXPath(targetXpath, { visible: true });
    const checkboxes = await this.page.$x(targetXpath);
    for (const ck of checkboxes) {
      await ck.click();
    }
    await this.selectYearOfBirth('1955');
    await this.selectEducationLevel(EducationLevelValue.Doctorate);
  }

}
