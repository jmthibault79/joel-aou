import Dialog, {ButtonLabel} from 'app/component/dialog';
import Button from 'app/element/button';
import Checkbox from 'app/element/checkbox';
import Select from 'app/element/select';
import Textbox from 'app/element/textbox';
import WebComponent from 'app/element/web-component';
import AuthenticatedPage from 'app/page/authenticated-page';
import {ElementType} from 'app/xpath-options';
import {ElementHandle, Page} from 'puppeteer';
import {waitWhileLoading} from 'utils/test-utils';
import {waitForDocumentTitle} from 'utils/waits-utils';
import {xPathOptionToXpath} from '../element/xpath-defaults';

const faker = require('faker/locale/en_US');

export const PAGE = {
  TITLE: 'Create Workspace',
};

export const LABEL_ALIAS = {
  SYNTHETIC_DATASET: 'Workspace Name',  // select Synthetic DataSet
  SELECT_BILLING: 'Select account',   // select billing account
  CREATE_WORKSPACE: 'Create Workspace',  // button CREATE WORKSPACE on edit page
  DUPLICATE_WORKSPACE: 'Duplicate Workspace', // button DUPLICATE WORKSPACE on edit page
  CANCEL: `Cancel`,  // button CANCEL on edit page
  WORKSPACE_NAME: 'Workspace Name',  // Workspace name input textbox
  RESEARCH_PURPOSE: 'Research purpose',
  EDUCATION_PURPOSE: 'Educational Purpose',
  FOR_PROFIT_PURPOSE: 'For-Profit Purpose',
  OTHER_PURPOSE: 'Other Purpose',
  DISEASE_FOCUSED_RESEARCH: 'Disease-focused research',
  POPULATION_HEALTH: 'Population Health/Public Health Research',
  METHODS_DEVELOPMENT: 'Methods development/validation study',
  DRUG_THERAPEUTIC_DEVELOPMENT: 'Drug/Therapeutics Development Research',
  RESEARCH_CONTROL: 'Research Control',
  GENETIC_RESEARCH: 'Genetic Research',
  SOCIAL_BEHAVIORAL_RESEARCH: 'Social/Behavioral Research',
  ETHICAL_LEGAL_SOCIAL_IMPLICATIONS: 'Ethical, Legal, and Social Implications (ELSI) Research',
  INTENT_TO_STUDY: 'What are the specific scientific question(s) you intend to study',
  SCIENTIFIC_APPROACHES: 'What are the scientific approaches you plan to use for your study',
  ANTICIPATED_FINDINGS: 'What are the anticipated findings from the study',
  PUBLICATION_IN_JOURNALS: 'Publication in peer-reviewed scientific journals',
  SOCIAL_MEDIA: 'Social media (Facebook, Instagram, Twitter)',
  PRESENTATION_AT_CONFERENCES: 'Presentation at national or international scientific conferences',
  PRESENTATION_AT_COMMUNITY_FORUMS: 'Presentation at community forums or advisory groups',
  PRESS_RELEASE: 'Press release or media article covering scientific publication',
  PUBLICATION_IN_COMMUNITY_JOURNALS: 'Publication in community-based journals or blog',
  PUBLICATION_IN_PERSONAL_BLOG: 'Publication of article in a personal blog',
  OTHER: 'Other',
  INCREASE_WELLNESS: 'This research project seeks to increase wellness and resilience',
  SEEKS_TO_REDUCE_HEALTH_DISPARITIES: 'This research project seeks to reduce health disparities and improve health equity ',
  SEEKS_TO_DEVELOP_RISK_ASSESSMENT: 'This research project seeks to develop improved risk assessment and prevention strategies to preempt disease',
  SEEKS_TO_PROVIDE_ACCURATE_DIAGNOSIS: 'This research project seeks to provide earlier and more accurate diagnosis to decrease illness burden',
  SEEKS_TO_REDUCE_BURDEN: 'This research project seeks to improve health outcomes and reduce disease/illness burden',
  YES_FOCUS_ON_UNDERREPRESENTED_POPULATION: 'Yes, my study will focus on one or more specific underrepresented populations',
  NO_FOCUS_ON_UNDERREPRESENTED_POPULATION: 'No, my study will not center on underrepresented populations',
  RACE_MULTI_ANCESTRY: 'Multi-Ancestry or more than one race',
  AGE_GROUPS_ADOLESCENTS: 'Adolescents',
  SEX_AT_BIRTH: 'Participants who report something other than female or male as their sex at birth',
  GENDER_IDENTITY: 'Participants who identify as gender variant',
  GEOGRAPHY_RURAL: 'Participants who live in a rural or non-metropolitan setting',
  EDUCATION_LEVEL_HIGHSCHOOL: 'Participants with less than a high school degree or equivalent',
  DISABILITY_STATUS_WITH_DISABILITY: 'Participants with a physical and/or cognitive disability',
  NO_REQUEST_REVIEW: 'No, I have no concerns at this time about potential stigmatization',
  YES_REQUEST_REVIEW: 'Yes, I would like to request a review of my research purpose',
  SHARE_WITH_COLLABORATORS: 'Share workspace with the same set of collaborators', // visible when clone workspace
};


export const FIELD = {
  createWorkspaceButton: {
    textOption: {name: LABEL_ALIAS.CREATE_WORKSPACE}
  },
  duplicateWorkspaceButton: {
    textOption: {name: LABEL_ALIAS.DUPLICATE_WORKSPACE}
  },
  cancelWorkspaceButton: {
    textOption: {name: LABEL_ALIAS.CANCEL}
  },
  workspaceNameTextbox: {
    textOption: {name: LABEL_ALIAS.WORKSPACE_NAME, ancestorLevel: 2, type: ElementType.Textbox}
  },
  dataSetSelect: {
    textOption: {name: LABEL_ALIAS.SYNTHETIC_DATASET, type: ElementType.Select}
  },
  billingAccountSelect: {
    textOption: {name: LABEL_ALIAS.SELECT_BILLING, type: ElementType.Select}
  },
  shareWithCollaboratorsCheckbox: {
    textOption: {name: LABEL_ALIAS.SHARE_WITH_COLLABORATORS, type: ElementType.Checkbox}
  },
  PRIMARY_PURPOSE: { // fields in question #1
    researchPurposeCheckbox: {
      textOption: {name: LABEL_ALIAS.RESEARCH_PURPOSE, ancestorLevel: 3, type: ElementType.Checkbox}
    },
    diseaseFocusedResearchCheckbox: {
      textOption:  {name: LABEL_ALIAS.DISEASE_FOCUSED_RESEARCH, ancestorLevel: 2, type: ElementType.Checkbox},
      affiliated: ElementType.Textbox,
    },
    methodsDevelopmentValidationStudyCheckbox: {
      textOption: {name: LABEL_ALIAS.METHODS_DEVELOPMENT, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    researchControlCheckbox: {
      textOption: {name: LABEL_ALIAS.RESEARCH_CONTROL, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    geneticResearchCheckbox: {
      textOption: {name: LABEL_ALIAS.GENETIC_RESEARCH, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    socialBehavioralResearchCheckbox: {
      textOption: {name: LABEL_ALIAS.SOCIAL_BEHAVIORAL_RESEARCH, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    populationHealthCheckbox: {
      textOption: {name: LABEL_ALIAS.POPULATION_HEALTH, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    ethicalLegalSocialImplicationsResearchCheckbox: {
      textOption: {name: LABEL_ALIAS.ETHICAL_LEGAL_SOCIAL_IMPLICATIONS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    drugTherapeuticsDevelopmentResearchCheckbox: {
      textOption:  {name: LABEL_ALIAS.DRUG_THERAPEUTIC_DEVELOPMENT, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    educationPurposeCheckbox: {
      textOption: {name: LABEL_ALIAS.EDUCATION_PURPOSE, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    forProfitPurposeCheckbox: {
      textOption: {name: LABEL_ALIAS.FOR_PROFIT_PURPOSE, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    otherPurposeCheckbox: {
      textOption: {name: LABEL_ALIAS.OTHER_PURPOSE, ancestorLevel: 2, type: ElementType.Checkbox},
      affiliated: ElementType.Textarea
    }
  },
  RESEARCH_PURPOSE_SUMMARY: {  // fields in question #2
    scientificQuestionsIntentToStudyTextarea: {
      textOption: {containsText: LABEL_ALIAS.INTENT_TO_STUDY, ancestorLevel: 3, type: ElementType.Textarea}
    },
    scientificApproachesToUseTextarea: {
      textOption: {containsText: LABEL_ALIAS.SCIENTIFIC_APPROACHES, ancestorLevel: 3, type: ElementType.Textarea}
    },
    anticipatedFindingsFromStudyTextarea: {
      textOption: {containsText: LABEL_ALIAS.ANTICIPATED_FINDINGS, ancestorLevel: 3, type: ElementType.Textarea}
    }
  },
  DISSEMINATE_RESEARCH_FINDINGS: {  // fields in question #3
    publicationInScientificJournalsCheckbox: {
      textOption: {containsText: LABEL_ALIAS.PUBLICATION_IN_JOURNALS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    socialMediaCheckbox: {
      textOption: {containsText: LABEL_ALIAS.SOCIAL_MEDIA, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    presentationAtScientificConferencesCheckbox: {
      textOption: {containsText: LABEL_ALIAS.PRESENTATION_AT_CONFERENCES, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    presentationAtCommunityForumsCheckbox: {
      textOption: {containsText: LABEL_ALIAS.PRESENTATION_AT_COMMUNITY_FORUMS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    pressReleaseCheckbox: {
      textOption: {containsText: LABEL_ALIAS.PRESS_RELEASE, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    publicationInCommunityJournalsCheckbox: {
      textOption: {containsText: LABEL_ALIAS.PUBLICATION_IN_COMMUNITY_JOURNALS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    publicationInPersonalBlogCheckbox: {
      textOption: {containsText: LABEL_ALIAS.PUBLICATION_IN_PERSONAL_BLOG, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    otherCheckbox: {
      textOption: {name: LABEL_ALIAS.OTHER, ancestorLevel: 2, type: ElementType.Checkbox},
      affiliated: ElementType.Textarea
    }
  },
  DESCRIBE_ANTICIPATED_OUTCOMES: {  // fields in question #4
    seeksIncreaseWellnessCheckbox: {
      textOption: {containsText: LABEL_ALIAS.INCREASE_WELLNESS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    seeksToReduceHealthDisparitiesCheckbox: {
      textOption: {containsText: LABEL_ALIAS.SEEKS_TO_REDUCE_HEALTH_DISPARITIES, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    seeksToDevelopRiskAssessmentCheckbox: {
      textOption: {containsText: LABEL_ALIAS.SEEKS_TO_DEVELOP_RISK_ASSESSMENT, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    seeksToProvideEarlierDiagnosisCheckbox: {
      textOption: {containsText: LABEL_ALIAS.SEEKS_TO_PROVIDE_ACCURATE_DIAGNOSIS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    seeksToReduceBurdenCheckbox: {
      textOption: {containsText: LABEL_ALIAS.SEEKS_TO_REDUCE_BURDEN, ancestorLevel: 2, type: ElementType.Checkbox}
    }
  },
  POPULATION_OF_INTEREST: {  // fields in question #5
    yesRadiobutton: {
      textOption: {containsText: LABEL_ALIAS.YES_FOCUS_ON_UNDERREPRESENTED_POPULATION, type: ElementType.RadioButton}
    },
    noRadiobutton: {
      textOption: {containsText: LABEL_ALIAS.NO_FOCUS_ON_UNDERREPRESENTED_POPULATION, type: ElementType.RadioButton}
    },
    raceMultiAncestryCheckbox: {
      textOption: {containsText: LABEL_ALIAS.RACE_MULTI_ANCESTRY, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    ageGroupsAdolescentsCheckbox: {
      textOption: {containsText: LABEL_ALIAS.AGE_GROUPS_ADOLESCENTS, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    sexAtBirthCheckbox: {
      textOption: {containsText: LABEL_ALIAS.SEX_AT_BIRTH, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    genderIdentityCheckbox: {
      textOption: {containsText: LABEL_ALIAS.GENDER_IDENTITY, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    geographyRuralCheckbox: {
      textOption: {containsText: LABEL_ALIAS.GEOGRAPHY_RURAL, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    educationLevelHighSchoolCheckbox: {
      textOption: {containsText: LABEL_ALIAS.EDUCATION_LEVEL_HIGHSCHOOL, ancestorLevel: 2, type: ElementType.Checkbox}
    },
    disabilityStatusWithDisabilityCheckbox: {
      textOption: {containsText: LABEL_ALIAS.DISABILITY_STATUS_WITH_DISABILITY, ancestorLevel: 2, type: ElementType.Checkbox}
    }
  },
  REQUEST_FOR_REVIEW: {  // fields in question #6
    yesRequestReviewRadiobutton: {
      textOption: {containsText: LABEL_ALIAS.YES_REQUEST_REVIEW, type: ElementType.RadioButton}
    },
    noRequestReviewRadiobutton: {
      textOption: {containsText: LABEL_ALIAS.NO_REQUEST_REVIEW, type: ElementType.RadioButton}
    }
  }

};


export default class WorkspaceEditPage extends AuthenticatedPage {

  constructor(page: Page) {
    super(page);
  }

  async isLoaded(): Promise<boolean> {
    const selectXpath = xPathOptionToXpath(FIELD.billingAccountSelect.textOption);
    const select = new Select(this.page, selectXpath);
    try {
      await Promise.all([
        waitForDocumentTitle(this.page, PAGE.TITLE),
        this.getWorkspaceNameTextbox(),
        select.getSelectedOption(),
        this.getCreateWorkspaceButton(),
        waitWhileLoading(this.page),
      ]);
      return true;
    } catch (err) {
      console.log(`WorkspaceEditPage isLoaded() encountered ${err}`);
      return false;
    }
  }

  async getCreateWorkspaceButton(): Promise<Button> {
    return Button.forLabel(this.page, FIELD.createWorkspaceButton.textOption);
  }

  async getDuplicateWorkspaceButton(): Promise<Button> {
    // Cannot use Button.forLabel because it finds two elements on Duplicate workspace page.
    // Don't change. use this xpath to find the button "DUPLICATE WORKSPACE".
    return new Button(this.page, '//*[text()="Duplicate Workspace" and @role="button"]');
  }

  async getCancelButton(): Promise<Button> {
    return Button.forLabel(this.page, FIELD.cancelWorkspaceButton.textOption);
  }

  async getWorkspaceNameTextbox(): Promise<Textbox> {
    return await Textbox.forLabel(this.page, FIELD.workspaceNameTextbox.textOption);
  }

  question1_researchPurpose(): WebComponent {
    return new WebComponent(this.page, FIELD.PRIMARY_PURPOSE.researchPurposeCheckbox.textOption);
  }

  question1_educationalPurpose(): WebComponent {
    return new WebComponent(this.page, FIELD.PRIMARY_PURPOSE.educationPurposeCheckbox.textOption);
  }

  question1_forProfitPurpose(): WebComponent {
    return new WebComponent(this.page, FIELD.PRIMARY_PURPOSE.forProfitPurposeCheckbox.textOption);
  }

  question1_otherPurpose(): WebComponent {
    return new WebComponent(this.page, FIELD.PRIMARY_PURPOSE.otherPurposeCheckbox.textOption);
  }

  question1_diseaseFocusedResearch(): WebComponent {
    return new WebComponent(this.page, FIELD.PRIMARY_PURPOSE.diseaseFocusedResearchCheckbox.textOption);
  }

  question2_scientificQuestionsIntendToStudy(): WebComponent {
    return new WebComponent(this.page, FIELD.RESEARCH_PURPOSE_SUMMARY.scientificQuestionsIntentToStudyTextarea.textOption);
  }

  question2_scientificApproaches(): WebComponent {
    return new WebComponent(this.page, FIELD.RESEARCH_PURPOSE_SUMMARY.scientificApproachesToUseTextarea.textOption);
  }

  question2_anticipatedFindings(): WebComponent {
    return new WebComponent(this.page, FIELD.RESEARCH_PURPOSE_SUMMARY.anticipatedFindingsFromStudyTextarea.textOption);
  }

  // Question 3. one of many checkboxes
  publicationInJournal(): WebComponent {
    return new WebComponent(this.page, FIELD.DISSEMINATE_RESEARCH_FINDINGS.publicationInScientificJournalsCheckbox.textOption);
  }

  // Question 4. one of many checkboxes
  increaseWellnessResilience(): WebComponent {
    return new WebComponent(this.page, FIELD.DESCRIBE_ANTICIPATED_OUTCOMES.seeksIncreaseWellnessCheckbox.textOption);
  }

  /**
   * Select Synthetic DataSet.
   * @param {string} optionValue: 1 for "Synthetic DataSet 1". 2 for "Synthetic DataSet 2".
   */
  async selectDataSet(optionValue: string = '2') {
    const dataSetSelect = await Select.forLabel(this.page, FIELD.dataSetSelect.textOption);
    await dataSetSelect.selectOption(optionValue);
  }

  /**
   * Select Billing Account
   * @param {string} billingAccount
   */
  async selectBillingAccount(billingAccount: string = 'Use All of Us free credits') {
    const billingAccountSelect = await Select.forLabel(this.page, FIELD.billingAccountSelect.textOption);
    await billingAccountSelect.selectOption(billingAccount);
  }

  /**
   * Assumption: Checked checkbox means to expand the section, hidden questions will become visible.
   * @param {boolean} yesOrNo: True means to check checkbox. False means to uncheck.
   */
  async expandResearchPurposeGroup(yesOrNo: boolean = true) {
    // expand Disease purpose section if needed
    const researchPurpose = this.question1_researchPurpose();
    const researchPurposeCheckbox = await researchPurpose.asCheckBox();
    const is = await researchPurposeCheckbox.isChecked();
    if (yesOrNo !== is) {
      // click checkbox expands or collapses the section, reveal hidden questions contained inside.
      await researchPurposeCheckbox.check();
    }
  }

  /**
   *  Enter value in 'Disease-focused research' textbox
   * @param {string} diseaseName
   */
  async fillOutDiseaseFocusedResearch(diseaseName: string = 'diabetic cataract') {
    const diseaseNameComponent = this.question1_diseaseFocusedResearch();
    await (await diseaseNameComponent.asCheckBox()).check();
    await (await diseaseNameComponent.asTextBox()).type(diseaseName);
    await (await diseaseNameComponent.asTextBox()).tabKey();
  }

  /**
   * Enter value in Other Purpose textarea
   * @param {string} value
   */
  async fillOutOtherPurpose(value?: string) {
    if (value === undefined) {
      value = faker.lorem.paragraph();
    }
    // check Other-Purpose checkbox
    const otherPurpose = this.question1_otherPurpose();
    await (await otherPurpose.asCheckBox()).check(); // enables textarea
    await (await otherPurpose.asTextArea()).type(value);
  }

  /**
   * Question 6. Request for Review of Research Purpose Description
   * @param selected: True means select "Yes, Request Review" radiobutton. False means select "No, Request Review" radiobutton.
   */
  async requestForReviewRadiobutton(selected: boolean) {
    let radioComponent;
    if (selected) {
      radioComponent = new WebComponent(this.page, FIELD.REQUEST_FOR_REVIEW.yesRequestReviewRadiobutton.textOption);
    } else {
      radioComponent = new WebComponent(this.page, FIELD.REQUEST_FOR_REVIEW.noRequestReviewRadiobutton.textOption);
    }
    await (await radioComponent.asRadioButton()).select();
  }

  /**
   * Find and click the CREATE WORKSPACE (FINISH) button
   */
  async clickCreateFinishButton(button: ElementHandle | Button): Promise<string> {
    await button.focus(); // bring into viewport
    await button.click();

    // confirm create in pop-up dialog
    const dialog = new Dialog(this.page);
    const dialogText = await dialog.getContent();
    await Promise.all([
      dialog.clickButton(ButtonLabel.Confirm),
      dialog.waitUntilDialogIsClosed(),
      this.page.waitForNavigation({waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 60000}),
    ]);
    await waitWhileLoading(this.page);
    return dialogText;
  }

  async clickShareWithCollaboratorsCheckbox() {
    const elemt = await Checkbox.forLabel(this.page, FIELD.shareWithCollaboratorsCheckbox.textOption);
    await elemt.check();
  }

}
