import {Button} from 'app/components/buttons';
import {FormSection} from 'app/components/forms';
import {Header} from 'app/components/headers';

import {
  InfoIcon,
  ValidationIcon
} from 'app/components/icons';

import {
  Error,
  ErrorMessage,
  RadioButton,
  styles as inputStyles,
  TextArea,
  TextInput,
  ValidationError
} from 'app/components/inputs';

import {
  TooltipTrigger
} from 'app/components/popups';

import {
  profileApi
} from 'app/services/swagger-fetch-clients';

import {FlexColumn, FlexRowWrap} from 'app/components/flex';
import colors from 'app/styles/colors';
import {summarizeErrors} from 'app/utils/index';
import {environment} from 'environments/environment';
import {
  DataAccessLevel,
  Degree,
  EducationalRole,
  IndustryRole,
  InstitutionalAffiliation,
  NonAcademicAffiliation,
  Profile,
} from 'generated/fetch';
import * as fp from 'lodash/fp';
import {Dropdown} from 'primereact/dropdown';
import {MultiSelect} from 'primereact/multiselect';
import * as React from 'react';
import * as validate from 'validate.js';
import {AccountCreationOptions} from './account-creation-options';

function isBlank(s: string) {
  return (!s || /^\s*$/.test(s));
}


export interface AccountCreationProps {
  profile: Profile;
  invitationKey: string;
  setProfile: Function;
}

export interface AccountCreationState {
  creatingAccount: boolean;
  errors: any;
  invalidEmail: boolean;
  rolesOptions: any;
  profile: Profile;
  showAllFieldsRequiredError: boolean;
  showInstitution: boolean;
  showNonAcademicAffiliationRole: boolean;
  showNonAcademicAffiliationOther: boolean;
  usernameCheckInProgress: boolean;
  usernameConflictError: boolean;
  institutionName: string;
  institutionRole: string;
  nonAcademicAffiliation: string;
  nonAcademicAffiliationRole: string;
  nonAcademicAffiliationOther: string;
}

const styles = {
  sectionLabel: {
    height: '22px',
    color: colors.primary,
    fontFamily: 'Montserrat',
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '22px',
    paddingBottom: '1.5rem'
  },
  section: {
    width: '12rem',
    height: '1.5rem'
  }
};

const nameLength = 80;

export const Section = (props) => {
  return <FormSection
      style={{display: 'flex', flexDirection: 'column', paddingTop: '1rem', ...props.style}}>
    <label style={styles.sectionLabel}>
      {props.header}
    </label>
    {props.children}
  </FormSection>;
};

export class AccountCreation extends React.Component<AccountCreationProps, AccountCreationState> {
  private usernameCheckTimeout: NodeJS.Timer;

  constructor(props: AccountCreationProps) {
    super(props);
    this.state = {
      errors: undefined,
      profile: {
        // Note: We abuse the "username" field here by omitting "@domain.org". After
        // profile creation, this field is populated with the full email address.
        username: '',
        dataAccessLevel: DataAccessLevel.Unregistered,
        givenName: '',
        familyName: '',
        contactEmail: '',
        currentPosition: '',
        organization: '',
        areaOfResearch: '',
        address: {
          streetAddress1: '',
          streetAddress2: '',
          city: '',
          state: '',
          country: '',
          zipCode: '',
        },
        institutionalAffiliations: [
          {
            institution: undefined,
            nonAcademicAffiliation: undefined,
            role: undefined
          }
        ],
        degrees: [] as Degree[]
      },
      usernameCheckInProgress: false,
      usernameConflictError: false,
      creatingAccount: false,
      showAllFieldsRequiredError: false,
      showInstitution: true,
      showNonAcademicAffiliationRole: false,
      showNonAcademicAffiliationOther: false,
      invalidEmail: false,
      rolesOptions: [],
      institutionName: '',
      institutionRole: '',
      nonAcademicAffiliation: '',
      nonAcademicAffiliationRole: '',
      nonAcademicAffiliationOther: ''
    };
  }

  componentDidMount() {
    if (this.props.profile.address) {
      const {institutionalAffiliations} = this.props.profile;
      if (institutionalAffiliations[0].institution) {
        this.setState({showInstitution: true});
      } else {
        this.setState({showInstitution: false});
        this.updateNonAcademicAffiliationRoles(institutionalAffiliations[0].nonAcademicAffiliation);
        this.selectNonAcademicAffiliationRoles(institutionalAffiliations[0].role);
      }
      this.setState({profile: this.props.profile});


    }
  }

  // This method will be deleted once we enable new account pages
  createAccount(): void {
    const {invitationKey, setProfile} = this.props;
    const profile = this.state.profile;
    profile.institutionalAffiliations = [];
    const emailValidRegex = new RegExp(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/);
    this.setState({showAllFieldsRequiredError: false});
    this.setState({invalidEmail: false});
    const requiredFields =
      [profile.givenName, profile.familyName, profile.username, profile.contactEmail,
        profile.currentPosition, profile.organization, profile.areaOfResearch];
    if (requiredFields.some(isBlank)) {
      this.setState({showAllFieldsRequiredError: true});
      return;
    } else if (this.isUsernameValidationError) {
      return;
    } else if (!emailValidRegex.test(profile.contactEmail)) {
      this.setState({invalidEmail: true});
      return;
    }
    this.setState({creatingAccount: true});
    profileApi().createAccount({profile, invitationKey})
      .then((savedProfile) => {
        this.setState({profile: savedProfile, creatingAccount: false});
        setProfile(savedProfile, 'accountCreationSuccess'); })
      .catch(error => {
        console.log(error);
        this.setState({creatingAccount: false});
      });
  }

  get usernameValid(): boolean {
    if (isBlank(this.state.profile.username) || this.state.usernameCheckInProgress) {
      return undefined;
    }
    return !this.isUsernameValidationError;
  }

  get isUsernameValidationError(): boolean {
    return (this.state.usernameConflictError || this.usernameInvalidError());
  }

  usernameInvalidError(): boolean {
    const username = this.state.profile.username;
    if (isBlank(username)) {
      return false;
    }
    if (username.trim().length > 64 || username.trim().length < 3) {
      return true;
    }
    // Include alphanumeric characters, -'s, _'s, apostrophes, and single .'s in a row.
    if (username.includes('..') || username.endsWith('.')) {
      return true;
    }
    return !(new RegExp(/^[\w'-][\w.'-]*$/).test(username));
  }

  usernameChanged(value: string): void {
    this.updateProfileToBeDeleted('username', value);
    const {username} = this.state.profile;
    if (username === '') {
      return;
    }
    this.setState({usernameConflictError: false});
    // TODO: This should use a debounce, rather than manual setTimeout()s.
    clearTimeout(this.usernameCheckTimeout);
    this.setState({usernameCheckInProgress: true});
    this.usernameCheckTimeout = setTimeout(() => {
      if (!username.trim()) {
        this.setState({usernameCheckInProgress: false});
        return;
      }
      profileApi().isUsernameTaken(username)
          .then((body) => {
            this.setState({usernameCheckInProgress: false, usernameConflictError: body.isTaken});
          })
          .catch((error) => {
            console.log(error);
            this.setState({usernameCheckInProgress: false});
          });
    }, 300);
  }

  updateProfileToBeDeleted(attribute: string, value: string) {
    if (attribute === 'contactEmail') {
      this.setState({invalidEmail: false});
    }
    const newProfile = this.state.profile;
    newProfile[attribute] = value;
    this.setState(({profile}) => ({profile: fp.set(attribute, value, profile)}));
  }

  updateProfileObject(attribute: string, value) {
    this.setState(fp.set(['profile', attribute], value));
  }

  updateAddress(attribute: string , value) {
    this.setState(fp.set(['profile', 'address', attribute], value));
  }

  // As of now we can add just one industry name role, this will change later
  updateInstitutionAffiliation(attribute: string, value) {
    const profile = this.state.profile;
    if (profile.institutionalAffiliations && profile.institutionalAffiliations.length > 0) {
      profile.institutionalAffiliations[0][attribute] = value;
    } else {
      const institutionalAffiliation = {} as InstitutionalAffiliation;
      institutionalAffiliation[attribute] = value;
      profile.institutionalAffiliations = [institutionalAffiliation];
    }
    this.setState({profile: profile});
  }

  showFreeTextField(option) {
    return option === NonAcademicAffiliation.FREETEXT || option === IndustryRole.FREETEXT ||
        option === EducationalRole.FREETEXT;
  }

  clearInstitutionAffiliation() {
    this.updateInstitutionAffiliation('nonAcademicAffiliation', '');
    this.updateInstitutionAffiliation('role', '');
    this.updateInstitutionAffiliation('institution', '');
    this.updateInstitutionAffiliation('other', '');
  }

  updateNonAcademicAffiliationRoles(nonAcademicAffiliation) {
    this.updateInstitutionAffiliation('nonAcademicAffiliation', nonAcademicAffiliation);
    this.setState({showNonAcademicAffiliationRole: false, showNonAcademicAffiliationOther: false});
    if (nonAcademicAffiliation === NonAcademicAffiliation.INDUSTRY) {
      this.setState({rolesOptions: AccountCreationOptions.industryRole,
        showNonAcademicAffiliationRole: true});
    } else if (nonAcademicAffiliation === NonAcademicAffiliation.EDUCATIONALINSTITUTION) {
      this.setState({rolesOptions: AccountCreationOptions.educationRole, showNonAcademicAffiliationRole: true});
    } else if (this.showFreeTextField(nonAcademicAffiliation)) {
      this.setState({showNonAcademicAffiliationOther: true});
      return;
    }
    this.selectNonAcademicAffiliationRoles(this.state.nonAcademicAffiliationRole);
  }

  selectNonAcademicAffiliationRoles(role) {
    if (this.showFreeTextField(role)) {
      this.setState({nonAcademicAffiliationRole: role, showNonAcademicAffiliationOther: true});
    } else {
      this.setState({nonAcademicAffiliationRole: role, showNonAcademicAffiliationOther: false});
    }
    this.updateInstitutionAffiliation('role', role);

  }

  // This will be deleted once enableAccountPages is set to true for prod
  validate() {
    const {profile} = this.state;
    const requiredFields =
      [profile.givenName, profile.familyName, profile.username, profile.contactEmail,
        profile.currentPosition, profile.organization, profile.areaOfResearch];
    if (requiredFields.some(isBlank)) {
      this.setState({showAllFieldsRequiredError: true});
      return;
    }
  }

  validateAccountCreation() {
    const {
      showInstitution,
      profile: { givenName, familyName, contactEmail,
        address: {streetAddress1, city, country, state},
        institutionalAffiliations: [{institution, nonAcademicAffiliation, role}]
      }
    } = this.state;

    const presenceCheck = {
      presence: {
        allowEmpty: false
      }
    };

    const validationCheck = {
      givenName: presenceCheck,
      familyName: presenceCheck,
      contactEmail: {
        presence: presenceCheck,
        format: {
          pattern: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
          message: 'Invalid email address'
        }
      },
      streetAddress1: presenceCheck,
      city: presenceCheck,
      state: presenceCheck,
      country: presenceCheck
    };

    showInstitution ? validationCheck['institution'] = presenceCheck :
      validationCheck['nonAcademicAffiliation'] = presenceCheck;

    if (showInstitution || nonAcademicAffiliation !== NonAcademicAffiliation.COMMUNITYSCIENTIST) {
      validationCheck['role'] = presenceCheck;
    }


    const errors = validate({givenName, familyName, contactEmail, streetAddress1, city, state, country,
      institution, nonAcademicAffiliation, role}, validationCheck);
    this.setState({errors: errors}, () => {
      if (!this.state.errors) {
        this.props.setProfile(this.state.profile, 'accountCreationSurvey');
      }
    });
  }


  render() {
    const {
      profile: {
        givenName, familyName, currentPosition, organization,
        contactEmail, username, areaOfResearch,
        address: {
          streetAddress1, streetAddress2, city, state, zipCode, country
        },
        institutionalAffiliations
      },
    } = this.state;
    return <div id='account-creation'
                style={{paddingTop: environment.enableAccountPages ? '1.5rem' :
                      '3rem', paddingRight: '3rem', paddingLeft: '3rem'}}>
      <Header>Create your account</Header>
      {environment.enableAccountPages && <div style={{marginTop: '0.5rem'}}>
        <label style={{color: colors.primary, fontSize: 16}}>
          Please complete Step 1 of 2
        </label>
        {this.state.errors && <div className='error-messages'>
          <ValidationError>
            {summarizeErrors(this.state.errors)}
          </ValidationError>
        </div>}
        <Section header='Create an All of Us username'>
          <div>
            <TextInput id='username' name='username' placeholder='New Username'
                       value={username}
                       onChange={v => this.usernameChanged(v)}
                       invalid={this.state.usernameConflictError || this.usernameInvalidError()}
                       style={{...styles.section, marginRight: '0.5rem'}}/>
            <div style={inputStyles.iconArea}>
              <ValidationIcon validSuccess={this.usernameValid}/>
            </div>
            <TooltipTrigger content={<div>Usernames can contain only letters (a-z),
              numbers (0-9), dashes (-), underscores (_), apostrophes ('), and periods (.)
              (minimum of 3 characters and maximum of 64 characters).<br/>Usernames cannot
              begin or end with a period (.) and may not contain more than one period (.) in a row.
            </div>}>
              <InfoIcon style={{'height': '22px', 'paddingLeft': '2px'}}/>
            </TooltipTrigger>
            {this.state.usernameConflictError &&
            <div style={{height: '1.5rem'}}>
              <Error id='usernameConflictError'>
                Username is already taken.
              </Error></div>}
            {this.usernameInvalidError() &&
            <div style={{height: '1.5rem'}}><Error id='usernameError'>
              Username is not a valid username.
            </Error></div>}
          </div>
        </Section>
        <Section header='About you'>
          <FlexColumn>
            <div style={{paddingBottom: '1rem'}}>
              <TextInput id='givenName' name='givenName' autoFocus
                         placeholder='First Name'
                         value={givenName}
                         invalid={givenName.length > nameLength}
                         style={{...styles.section, marginRight: '2rem'}}
                         onChange={value => this.updateProfileObject('givenName', value)}/>
              {givenName.length > nameLength &&
              <ErrorMessage id='givenNameError'>
                First Name must be {nameLength} characters or less.
              </ErrorMessage>}
              <TextInput id='familyName' name='familyName' placeholder='Last Name'
                         value={familyName}
                         invalid={familyName.length > nameLength}
                         style={styles.section}
                         onChange={v => this.updateProfileObject('familyName', v)}/>
              {familyName.length > nameLength &&
              <ErrorMessage id='familyNameError'>
                Last Name must be {nameLength} character or less.
              </ErrorMessage>}
            </div>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <TextInput id='contactEmail' name='contactEmail'
                         placeholder='Email Address'
                         value={contactEmail}
                         style={styles.section}
                         onChange={v => this.updateProfileObject('contactEmail', v)}/>
              {this.state.invalidEmail &&
              <Error id='invalidEmailError'>
                Contact Email Id is invalid
              </Error>}
              <MultiSelect placeholder='Degree' options={AccountCreationOptions.degree}
                           style={{...styles.section, marginLeft: '2rem', overflowY: 'none'}}
                           value={this.state.profile.degrees}
                           onChange={(e) =>
                             this.updateProfileObject('degrees', e.value)}/>
            </div>
          </FlexColumn>
        </Section>
        <Section header='Your mailing address'>
          <FlexRowWrap style={{lineHeight: '1rem'}}>
            <TextInput data-test-id='streetAddress' name='streetAddress'
                       placeholder='Street Address' value={streetAddress1}
                       onChange={value => this.updateAddress('streetAddress1', value)}
                       style={{...styles.section, marginRight: '2rem', marginBottom: '0.5rem'}}/>
            <TextInput data-test-id='state' name='state' placeholder='State' value={state}
                       onChange={value => this.updateAddress('state', value)}
                       style={{...styles.section, marginBottom: '0.5rem'}}/>
            <TextInput data-test-id='streetAddress2' name='streetAddress2' placeholder='Street Address 2'
                       value={streetAddress2}
                       style={{...styles.section, marginRight: '2rem', marginBottom: '0.5rem'}}
                       onChange={value => this.updateAddress('streetAddress2', value)}/>
            <TextInput data-test-id='zip' name='zip' placeholder='Zip Code' value={zipCode}
                       onChange={value => this.updateAddress('zipCode', value)}
                       style={{...styles.section, marginBottom: '0.5rem'}}/>
            <TextInput data-test-id='city' name='city' placeholder='City' value={city}
                       onChange={value => this.updateAddress('city', value)}
                       style={{...styles.section, marginRight: '2rem'}}/>
            <TextInput data-test-id='country' placeholder='Country' value={country} style={styles.section}
                       onChange={value => this.updateAddress('country', value)}/>
          </FlexRowWrap>
        </Section>
        <Section header='Institutional Affiliation'>
          <label style={{color: colors.primary, fontSize: 16}}>
            Are you affiliated with an Academic Research Institution?
          </label>
          <div style={{paddingTop: '0.5rem'}}>
            <RadioButton data-test-id='show-institution-yes'
                         onChange={() => {this.clearInstitutionAffiliation();
                           this.setState({showInstitution: true}); }}
                         checked={this.state.showInstitution} style={{marginRight: '0.5rem'}}/>
            <label style={{paddingRight: '3rem', color: colors.primary}}>
              Yes
            </label>
            <RadioButton data-test-id='show-institution-no'
                         onChange={() => {this.clearInstitutionAffiliation();
                           this.setState({showInstitution: false}); }}
                         checked={!this.state.showInstitution} style={{marginRight: '0.5rem'}}/>
            <label style={{color: colors.primary}}>No</label>
          </div>
        </Section>
        {this.state.showInstitution &&
        <FlexColumn style={{justifyContent: 'space-between'}}>
          <TextInput data-test-id='institutionname' style={{width: '16rem', marginBottom: '0.5rem',
            marginTop: '0.5rem'}}
            value={institutionalAffiliations && institutionalAffiliations.length > 0 ?
                institutionalAffiliations[0].institution : ''}
            placeholder='Institution Name'
            onChange={value => this.updateInstitutionAffiliation('institution', value)}
                     ></TextInput>
          <Dropdown data-test-id='institutionRole' value={institutionalAffiliations &&
          institutionalAffiliations.length > 0 ?
              institutionalAffiliations[0].role : ''}
                    onChange={e => this.updateInstitutionAffiliation('role', e.value)}
                    placeholder='Which of the following describes your role'
                    style={{width: '16rem'}} options={AccountCreationOptions.roles}/>
        </FlexColumn>}
        {!this.state.showInstitution &&
        <FlexColumn style={{justifyContent: 'space-between'}}>
          <Dropdown data-test-id='affiliation'
                    style={{width: '18rem', marginBottom: '0.5rem', marginTop: '0.5rem'}}
                    value={institutionalAffiliations && institutionalAffiliations.length > 0 ?
                        institutionalAffiliations[0].nonAcademicAffiliation : ''}
                    options={AccountCreationOptions.nonAcademicAffiliations}
                    onChange={e => this.updateNonAcademicAffiliationRoles(e.value)}
                    placeholder='Which of the following better describes your affiliation?'/>
          {this.state.showNonAcademicAffiliationRole &&
          <Dropdown data-test-id='affiliationrole' placeholder='Which of the following describes your role'
                    options={this.state.rolesOptions} value={institutionalAffiliations
          && institutionalAffiliations.length > 0 ?
              institutionalAffiliations[0].role : ''}
                    onChange={e => this.selectNonAcademicAffiliationRoles(e.value)}
                    style={{width: '18rem'}}/>}
          {this.state.showNonAcademicAffiliationOther &&
          <TextInput value={institutionalAffiliations && institutionalAffiliations.length > 0 ?
              institutionalAffiliations[0].other : ''}
                     onChange={value => this.updateInstitutionAffiliation('other', value)}
                     style={{marginTop: '1rem', width: '18rem'}}/>}
        </FlexColumn>}
        <FormSection style={{paddingBottom: '1rem'}}>
          <Button disabled={this.state.usernameCheckInProgress || this.isUsernameValidationError}
                  style={{'height': '2rem', 'width': '10rem'}}
                  onClick={() => this.validateAccountCreation()}>
            Next
          </Button>
        </FormSection>
      </div>}
      {/*The following will be deleted once enableAccountPages is set to true in prod*/}
      {!environment.enableAccountPages && <div>
        <FormSection>
          <TextInput id='givenName' name='givenName' autoFocus
                     placeholder='First Name'
                     value={givenName}
                     invalid={givenName.length > 80}
                     style={{width: '16rem'}}
                     onChange={v => this.updateProfileToBeDeleted('givenName', v)}/>
          {givenName.length > 80 &&
          <ErrorMessage id='givenNameError'>
            First Name must be 80 characters or less.
          </ErrorMessage>}
        </FormSection>
        <FormSection>
          <TextInput id='familyName' name='familyName' placeholder='Last Name'
                     value={familyName}
                     invalid={familyName.length > 80}
                     style={{width: '16rem'}}
                     onChange={v => this.updateProfileToBeDeleted('familyName', v)}/>
          {familyName.length > 80 &&
          <ErrorMessage id='familyNameError'>
            Last Name must be 80 character or less.
          </ErrorMessage>}
        </FormSection>
        <FormSection>
          <TextInput id='contactEmail' name='contactEmail'
                     placeholder='Email Address'
                     value={contactEmail}
                     style={{width: '16rem'}}
                     onChange={v => this.updateProfileToBeDeleted('contactEmail', v)}/>
          {this.state.invalidEmail &&
          <Error id='invalidEmailError'>
            Contact Email Id is invalid
          </Error>}
        </FormSection>
        <FormSection>
          <TextInput id='currentPosition' name='currentPosition'
                     placeholder='Your Current Position'
                     value={currentPosition}
                     invalid={currentPosition.length > 255}
                     style={{width: '16rem'}}
                     onChange={v => this.updateProfileToBeDeleted('currentPosition', v)}/>
          {currentPosition.length > 255 &&
          <ErrorMessage id='currentPositionError'>
            Current Position must be 255 characters or less.
          </ErrorMessage>}
        </FormSection>
        <FormSection>
          <TextInput id='organization' name='organization'
                     placeholder='Your Organization'
                     value={organization}
                     invalid={organization.length > 255}
                     style={{width: '16rem'}}
                     onChange={v => this.updateProfileToBeDeleted('organization', v)}/>
          {organization.length > 255 &&
          <ErrorMessage id='organizationError'>
            Organization must be 255 characters of less.
          </ErrorMessage>}
        </FormSection>
        <FormSection style={{display: 'flex'}}>
              <TextArea style={{height: '10em', resize: 'none', width: '16rem'}}
                        id='areaOfResearch'
                        name='areaOfResearch'
                        placeholder='Describe Your Current Research'
                        value={areaOfResearch}
                        onChange={v => this.updateProfileToBeDeleted('areaOfResearch', v)}/>
          <TooltipTrigger content='You are required to describe your current research in
                      order to help All of Us improve the Researcher Workbench.'>
            <InfoIcon style={{
              'height': '22px',
              'marginTop': '2.2rem',
              'paddingLeft': '2px'
            }}/>
          </TooltipTrigger>
        </FormSection>
        <FormSection>
          <TextInput id='username' name='username' placeholder='New Username'
                     value={username}
                     onChange={v => this.usernameChanged(v)}
                     invalid={this.state.usernameConflictError || this.usernameInvalidError()}
                     style={{width: '16rem'}}/>
          <div style={inputStyles.iconArea}>
            <ValidationIcon validSuccess={this.usernameValid}/>
          </div>
          <TooltipTrigger content={<div>Usernames can contain only letters (a-z),
            numbers (0-9), dashes (-), underscores (_), apostrophes ('), and periods (.)
            (minimum of 3 characters and maximum of 64 characters).<br/>Usernames cannot
            begin or end with a period (.) and may not contain more than one period (.) in a row.
          </div>}>
            <InfoIcon style={{'height': '22px', 'paddingLeft': '2px'}}/>
          </TooltipTrigger>
          <div style={{height: '1.5rem'}}>
            {this.state.usernameConflictError &&
            <Error id='usernameConflictError'>
              Username is already taken.
            </Error>}
            {this.usernameInvalidError() &&
            <Error id='usernameError'>
              Username is not a valid username.
            </Error>}
          </div>
        </FormSection>
        <FormSection>
          <Button disabled={this.state.creatingAccount || this.state.usernameCheckInProgress ||
          this.isUsernameValidationError}
                  style={{'height': '2rem', 'width': '10rem'}}
                  onClick={() => this.createAccount()}>
            Next
          </Button>
        </FormSection>
      </div>}
      {!environment.enableAccountPages && this.state.showAllFieldsRequiredError &&
      <Error>
        All fields are required.
      </Error>}
    </div>;
  }
}
