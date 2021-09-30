import * as fp from 'lodash/fp';
import {Dropdown} from 'primereact/dropdown';
import {InputSwitch} from 'primereact/inputswitch';
import * as React from 'react';
import {RouteComponentProps, withRouter} from 'react-router-dom';
import validate from 'validate.js';

import {Button} from 'app/components/buttons';
import {FadeBox} from 'app/components/containers';
import {FlexColumn, FlexRow} from 'app/components/flex';
import {SemiBoldHeader} from 'app/components/headers';
import {ControlledTierBadge, RegisteredTierBadge} from 'app/components/icons';
import {TextArea, TextInputWithLabel} from 'app/components/inputs';
import {BulletAlignedUnorderedList} from 'app/components/lists';
import {Modal, ModalBody, ModalFooter, ModalTitle} from 'app/components/modals';
import {TooltipTrigger} from 'app/components/popups';
import {WithSpinnerOverlayProps} from 'app/components/with-spinner-overlay';
import {Scroll} from 'app/icons/scroll';
import {
  MembershipRequirements,
  OrganizationTypeOptions
} from 'app/pages/admin/admin-institution-options';
import {institutionApi} from 'app/services/swagger-fetch-clients';
import colors from 'app/styles/colors';
import {reactStyles} from 'app/utils';
import {AccessTierShortNames, displayNameForTier} from 'app/utils/access-tiers';
import {convertAPIError} from 'app/utils/errors';
import {
  defaultTierConfig,
  getControlledTierConfig,
  getControlledTierEmailAddresses,
  getControlledTierEmailDomains,
  getRegisteredTierConfig,
  getRegisteredTierEmailAddresses,
  getRegisteredTierEmailDomains,
  getTierConfig,
  updateCtEmailAddresses,
  updateCtEmailDomains,
  updateRtEmailAddresses,
  updateRtEmailDomains,
} from 'app/utils/institutions';
import {NavigationProps} from 'app/utils/navigation';
import {MatchParams, serverConfigStore, useStore} from 'app/utils/stores';
import {withNavigation} from 'app/utils/with-navigation-hoc';
import {
  Institution,
  InstitutionMembershipRequirement,
  InstitutionTierConfig,
  OrganizationType
} from 'generated/fetch';

const styles = reactStyles({
  label: {
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: '20px',
    color: colors.primary,
    marginTop: '1.5rem',
    marginBottom: '0.3rem'
  },
  tierBadge: {
    marginTop: '0.6rem',
    marginLeft: '0.6rem',
  },
  tierLabel: {
    fontSize: '16px',
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: '17px',
    color: '#333F52',
    marginTop: '0.8rem',
    marginBottom: '1rem'
  },
  tierConfigContainer: {
    width: '31rem',
    height: '20rem',
    borderRadius: '0.31rem',
    backgroundColor: 'rgba(33,111,180,0.1)',
    marginBottom: '1rem'
  },
  switch: {
    width: '2rem',
    height: '1.125rem',
    borderRadius: '0.31rem',
    onColor: '#080',
  },
});

// The easiest way to override primereact style.
const css = `
  body .p-inputswitch {
    height: 18px;
    width: 33px;
    border-radius: 15px;
    font-size:11px;
  }
  body .p-inputswitch.p-inputswitch-checked .p-inputswitch-slider {
    background-color: #659F3D;
 }
`;

enum InstitutionMode {
  ADD,
  EDIT
}

const isAddressInvalid = (emailAddress: string): boolean => {
  const errors = validate({emailAddress}, {emailAddress: {email: true}});
  return errors && errors.emailAddress && errors.emailAddress.length > 0;
}

const isDomainInvalid = (emailDomain: string): boolean => isAddressInvalid(`test@${emailDomain}`);

const getInvalidEmailAddresses = (emailAddresses: Array<string>): Array<string> => emailAddresses.filter(isAddressInvalid);

const getInvalidEmailDomains = (emailDomains: Array<string>): Array<string> => emailDomains.filter(isDomainInvalid);

const nonEmpty = (item: string): boolean => item && !!item.trim();

const EraRequiredSwitch = (props: {tierConfig: InstitutionTierConfig, onChange: (boolean) => void}) => {
  const {tierConfig, onChange} = props;
  const {config: {enableRasLoginGovLinking}} = useStore(serverConfigStore);
  return <InputSwitch
      data-test-id={`${tierConfig.accessTierShortName}-era-required-switch`}
      onChange={(v) => onChange(v.value)}
      checked={tierConfig.eraRequired}
      disabled={!enableRasLoginGovLinking || tierConfig.membershipRequirement === InstitutionMembershipRequirement.NOACCESS}
  />;
};

const EnableCtSwitch = (props: {institution: Institution, onChange: (boolean) => void}) => {
  const {institution, onChange} = props;
  return <InputSwitch
      data-test-id='controlled-enabled-switch'
      onChange={(v) => onChange(v.value)}
      checked={getControlledTierConfig(institution).membershipRequirement !== InstitutionMembershipRequirement.NOACCESS}
      disabled={false} // TODO
  />;
};

const RequirementDropdown = (props: {tierConfig: InstitutionTierConfig, onChange: (InstitutionMembershipRequirement) => void}) => {
  const {tierConfig, onChange} = props;
  return <Dropdown style={{width: '16rem'}}
                   data-test-id={`${tierConfig.accessTierShortName}-agreement-dropdown`}
                   placeholder='Select type'
                   options={MembershipRequirements}
                   value={tierConfig.membershipRequirement}
                   onChange={(v) => onChange(v.value)}/>;
};

const AddressTextArea = (props: {accessTierShortName: string, emailAddresses: string[], onBlur: Function, onChange: (string) => void}) => {
  const {accessTierShortName, emailAddresses, onBlur, onChange} = props;
  return <TextArea
      value={emailAddresses && emailAddresses.join(',\n')}
      data-test-id={`${accessTierShortName}-email-address-input`}
      onBlur={onBlur}
      onChange={onChange}/>;
};

const DomainTextArea = (props: {accessTierShortName: string, emailDomains: string[], onBlur: Function, onChange: (string) => void}) => {
  const {accessTierShortName, emailDomains, onBlur, onChange} = props;
  return <TextArea value={emailDomains && emailDomains.join(',\n')}
                   data-test-id={`${accessTierShortName}-email-domain-input`}
                   onBlur={onBlur}
                   onChange={onChange}/>;
};

interface TierConfigProps {
  institution: Institution;
  accessTierShortName: string;
  TierBadge: () => JSX.Element;
  setEnableControlledTier?: (boolean) => void;
  setEraRequired: (boolean) => void;
  setTierRequirement: (InstitutionMembershipRequirement) => void;
  filterEmptyAddresses: Function;
  setTierAddresses: (string) => void;
  filterEmptyDomains: Function;
  setTierDomains: (string) => void;
}
const TierConfig = (props: TierConfigProps) => {
  const {institution, accessTierShortName, TierBadge, setEnableControlledTier, setEraRequired, setTierRequirement,
    filterEmptyAddresses, setTierAddresses, filterEmptyDomains, setTierDomains} = props;

  const tierConfig = getTierConfig(institution, accessTierShortName);
  const {emailAddresses, emailDomains} = tierConfig;

  return <FlexRow style={styles.tierConfigContainer}>
    <div>
      <TierBadge/>
    </div>
    <FlexColumn style={{marginLeft: '0.4rem'}}>
      <label style={styles.tierLabel}>{displayNameForTier(accessTierShortName)} access</label>
      <FlexRow style={{gap: '0.3rem'}}>
        <EraRequiredSwitch tierConfig={tierConfig} onChange={setEraRequired}/>
        eRA account required
        {accessTierShortName === AccessTierShortNames.Controlled && <React.Fragment>
          <EnableCtSwitch institution={institution} onChange={setEnableControlledTier}/>
          Controlled tier enabled
        </React.Fragment>}
      </FlexRow>
      {tierConfig.membershipRequirement !== InstitutionMembershipRequirement.NOACCESS &&
        <div style={{marginTop: '1rem'}} data-test-id={`${accessTierShortName}-card-details`}>
          <label style={styles.label}>A user is considered part of this institution and eligible <br/>
            to access {displayNameForTier(accessTierShortName)} data if:</label>
          <RequirementDropdown tierConfig={tierConfig} onChange={setTierRequirement}/>
          {tierConfig.membershipRequirement === InstitutionMembershipRequirement.ADDRESSES &&
          <FlexColumn data-test-id={`${accessTierShortName}-email-address`} style={{width: '16rem'}}>
            <label style={styles.label}>Accepted Email Addresses</label>
            <AddressTextArea
              accessTierShortName={accessTierShortName}
              emailAddresses={emailAddresses}
              onBlur={filterEmptyAddresses}
              onChange={setTierAddresses}/>
            <p style={{color: colors.primary, fontSize: '12px', lineHeight: '18px'}}>
              Enter one email address per line.  <br/>
            </p>
          </FlexColumn>}
          {tierConfig.membershipRequirement === InstitutionMembershipRequirement.DOMAINS &&
          <FlexColumn data-test-id={`${accessTierShortName}-email-domain`} style={{width: '16rem'}}>
            <label style={styles.label}>Accepted Email Domains</label>
            <DomainTextArea
                accessTierShortName={accessTierShortName}
                emailDomains={emailDomains}
                onBlur={filterEmptyDomains}
                onChange={setTierDomains}/>
            <p style={{color: colors.primary, fontSize: '12px', lineHeight: '18px'}}>
              Enter one domain per line. <br/>
              Note that subdomains are not included, so “university.edu” <br/>
              matches alice@university.edu but not bob@med.university.edu.
            </p>
          </FlexColumn>}
        </div>}
    </FlexColumn>
  </FlexRow>;
};

const SaveErrorModal = (props: {onFinish: Function, onContinue: Function}) => {
  const {onFinish, onContinue} = props;
  return <Modal>
    <ModalTitle>Institution not saved</ModalTitle>
    <ModalFooter>
      <Button onClick={onFinish}
              type='secondary' style={{marginRight: '2rem'}}>Finish Saving</Button>
      <Button onClick={onContinue}
              type='primary'>Yes Continue</Button>
    </ModalFooter>
  </Modal>;
};

const ApiErrorModal = (props: {errorMsg: string, onClose: Function}) => {
  const {errorMsg, onClose} = props;
  return <Modal>
    <ModalTitle>Error While Saving Data</ModalTitle>
    <ModalBody>
      <label style={{...styles.label, fontWeight: 100}}>{errorMsg}</label>
    </ModalBody>
    <ModalFooter>
      <Button onClick={onClose}
              type='secondary'>Close</Button>
    </ModalFooter>
  </Modal>;
};

interface Props extends WithSpinnerOverlayProps, NavigationProps, RouteComponentProps<MatchParams> {}

interface InstitutionEditState {
  apiErrorMsg: string;
  institutionMode: InstitutionMode;
  institution: Institution;
  institutionBeforeEdits: Institution;
  showOtherInstitutionTextBox: boolean;
  showBackButtonWarning: boolean;
  showApiError: boolean;
  title: string;
}

export const AdminInstitutionEdit = fp.flow(withNavigation, withRouter)(class extends React.Component<Props, InstitutionEditState> {
  constructor(props) {
    super(props);
    this.state = {
      apiErrorMsg: '',
      institutionMode: InstitutionMode.ADD,
      // properly initialized by initEditMode() / initAddMode()
      institution: {
         shortName: '',
         displayName: '',
         organizationTypeEnum: null,
      },
      institutionBeforeEdits: null,
      showOtherInstitutionTextBox: false,
      showBackButtonWarning: false,
      showApiError: false,
      title: '',
    };
  }

  initEditMode(loadedInstitution: Institution) {
    this.setState({
      institutionMode: InstitutionMode.EDIT,
      institution: loadedInstitution,
      institutionBeforeEdits: loadedInstitution,
      showOtherInstitutionTextBox: loadedInstitution.organizationTypeEnum === OrganizationType.OTHER,
      title: loadedInstitution.displayName
    });
  }

  initAddMode() {
    this.setState({
      institutionMode: InstitutionMode.ADD,
      title: 'Add new Institution',
      institution: {
        shortName: '',
        displayName: '',
        organizationTypeEnum: null,
        tierConfigs: [{
          ...defaultTierConfig(AccessTierShortNames.Registered),
          membershipRequirement: null,  // the default is NOACCESS which also means "don't render the card"
        }]
      },
    });
  }

  async componentDidMount() {
    this.props.hideSpinner();
    // If institution short Name is passed in the URL get the institution details
    if (this.props.match.params.institutionId) {
      const loadedInstitution = await institutionApi().getInstitution(this.props.match.params.institutionId);
      this.initEditMode(loadedInstitution);
    } else {
      this.initAddMode();
    }
  }

  // Filter out empty line or empty email addresses like <email1>,,<email2> for registered tier
  filterEmptyRtEmailAddresses() {
    const updatedEmailAddresses = getRegisteredTierEmailAddresses(this.state.institution).filter(nonEmpty);
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateRtEmailAddresses(this.state.institution, updatedEmailAddresses)));
  }

  // Filter out empty line or empty email addresses like <email1>,,<email2> for controlled tier
  filterEmptyCtEmailAddresses() {
    const updatedEmailAddresses = getControlledTierEmailAddresses(this.state.institution).filter(nonEmpty);
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateCtEmailAddresses(this.state.institution, updatedEmailAddresses)));
  }

  // Filter out empty line or empty email addresses like <email1>,,<email2> for registered tier
  filterEmptyRtEmailDomains() {
    const updatedEmailDomains = getRegisteredTierEmailDomains(this.state.institution).filter(nonEmpty);
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateRtEmailDomains(this.state.institution, updatedEmailDomains)));
  }

  // Filter out empty line or empty email addresses like <email1>,,<email2> for controlled tier
  filterEmptyCtEmailDomains() {
    const updatedEmailDomains = getControlledTierEmailDomains(this.state.institution).filter(nonEmpty);
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateCtEmailDomains(this.state.institution, updatedEmailDomains)));
  }

  setRegisteredTierRequirement(membershipRequirement: InstitutionMembershipRequirement) {
    const rtTierConfig: InstitutionTierConfig = {
      ...getRegisteredTierConfig(this.state.institution),
      membershipRequirement: membershipRequirement,
    };
    this.setState(fp.set(['institution', 'tierConfigs'],
        [rtTierConfig, getControlledTierConfig(this.state.institution)]));
  }

  setControlledTierRequirement(membershipRequirement: InstitutionMembershipRequirement) {
    const ctTierConfig: InstitutionTierConfig = {
      ...getControlledTierConfig(this.state.institution),
      membershipRequirement: membershipRequirement,
    };
    this.setState(fp.set(['institution', 'tierConfigs'],
        [getRegisteredTierConfig(this.state.institution), ctTierConfig]));
  }

  setRtRequireEra(eRAEnabled: boolean) {
    const rtTierConfig: InstitutionTierConfig = {
      ...getRegisteredTierConfig(this.state.institution),
      eraRequired: eRAEnabled
    };
    this.setState(fp.set(['institution', 'tierConfigs'],
        [rtTierConfig, getControlledTierConfig(this.state.institution)]));
  }

  setCtRequireEra(eRAEnabled: boolean) {
    const ctTierConfig: InstitutionTierConfig = {
      ...getControlledTierConfig(this.state.institution),
      eraRequired: eRAEnabled
    };
    this.setState(fp.set(['institution', 'tierConfigs'],
        [getRegisteredTierConfig(this.state.institution), ctTierConfig]));
  }

  setEnableControlledTier(enableCtAccess: boolean) {
    // When switch from disable to enabled, set tier requirement from NOACCESS to DOMAINS with empty domain list.
    const ctTierConfig: InstitutionTierConfig = {
      ...getControlledTierConfig(this.state.institution),
      membershipRequirement: enableCtAccess === true ?
          InstitutionMembershipRequirement.DOMAINS : InstitutionMembershipRequirement.NOACCESS,
    };
    this.setState(fp.set(['institution', 'tierConfigs'],
        [getRegisteredTierConfig(this.state.institution), ctTierConfig]));
  }

  trimEmails(emails: string): Array<string> {
    return emails.split(/[,\n]+/).map(email => email.trim());
  }

  setRegisteredTierEmails(emailAddresses: string) {
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateRtEmailAddresses(this.state.institution, this.trimEmails(emailAddresses))));
  }

  setControlledTierEmails(emailAddresses: string) {
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateCtEmailAddresses(this.state.institution, this.trimEmails(emailAddresses))));
  }

  setRegisteredTierDomains(emailDomains: string) {
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateRtEmailDomains(this.state.institution, this.trimEmails(emailDomains))));
  }

  setControlledTierDomains(emailDomains: string) {
    this.setState(fp.set(['institution', 'tierConfigs'],
        updateCtEmailDomains(this.state.institution, this.trimEmails(emailDomains))));
  }

  // Check if the fields have not been edited
  fieldsNotEdited() {
    return (this.isAddInstitutionMode && !this.fieldsEditedAddInstitution)
        || (this.isEditInstitutionMode && !this.fieldsEditedEditInstitution);
  }

  get fieldsEditedAddInstitution() {
    const {institution} = this.state;
    return institution.displayName || institution.userInstructions ||
      institution.organizationTypeEnum || institution.tierConfigs;
  }

  get fieldsEditedEditInstitution() {
    const {institution, institutionBeforeEdits} = this.state;
    return institution !== institutionBeforeEdits;
  }

  hasInvalidFields() {
    const {institution} = this.state;
    if (!institution.tierConfigs) {
      // It is not expected for a tier requirement to be empty
      return true;
    }
  }

  // Disable save button if
  // a) there are any errors
  // b) any fields are invalid
  // c) No fields were edited
  disableSave(errors) {
    return errors || this.hasInvalidFields() || this.fieldsNotEdited();
  }

  backNavigate() {
    this.props.navigate(['admin', 'institution']);
  }

  async saveInstitution() {
    const {institution, institutionMode} = this.state;
    const rtConfig: InstitutionTierConfig = getRegisteredTierConfig(institution);
    const ctConfig: InstitutionTierConfig = getControlledTierConfig(institution);
    if (institution && rtConfig) {
      if (rtConfig.membershipRequirement === InstitutionMembershipRequirement.DOMAINS) {
        rtConfig.emailAddresses = [];
      } else if (rtConfig.membershipRequirement === InstitutionMembershipRequirement.ADDRESSES) {
        rtConfig.emailDomains = [];
      }
    }
    if (institution && ctConfig) {
      if (ctConfig.membershipRequirement === InstitutionMembershipRequirement.DOMAINS) {
        ctConfig.emailAddresses = [];
      } else if (ctConfig.membershipRequirement === InstitutionMembershipRequirement.ADDRESSES) {
        ctConfig.emailDomains = [];
      }
    }
    if (ctConfig.membershipRequirement === InstitutionMembershipRequirement.NOACCESS) {
      // Don't set CT if CT is NOACCESS
      institution.tierConfigs = [rtConfig];
    } else {
      institution.tierConfigs = [rtConfig, ctConfig];
    }
    if (institution && institution.organizationTypeEnum !== OrganizationType.OTHER) {
      institution.organizationTypeOtherText = null;
    }

    if (institutionMode === InstitutionMode.EDIT) {
      await institutionApi().updateInstitution(this.props.match.params.institutionId, institution)
        .then(() => this.backNavigate())
        .catch(reason => this.handleError(reason));
    } else {
      await institutionApi().createInstitution(institution)
        .then(() => this.backNavigate())
        .catch(reason => this.handleError(reason));
    }
  }

  async handleError(rejectReason) {
    let errorMsg = 'Error while saving Institution. Please try again later';
    const error = await convertAPIError(rejectReason);
    if (rejectReason.status === 409) {
      errorMsg  = error.message;
    }
    this.setState({apiErrorMsg: errorMsg, showApiError: true});
  }

  updateInstitutionRole(institutionRole) {
    this.setState({showOtherInstitutionTextBox: institutionRole === OrganizationType.OTHER});
    this.setState(fp.set(['institution', 'organizationTypeEnum'], institutionRole));
  }

  backButton() {
    if (!this.fieldsNotEdited()) {
      this.setState({showBackButtonWarning: true});
    } else {
      this.backNavigate();
    }
  }

  get buttonText() {
    return !this.isAddInstitutionMode ? 'SAVE' : 'ADD';
  }

  get isAddInstitutionMode() {
    return this.state.institutionMode === InstitutionMode.ADD;
  }

  get isEditInstitutionMode() {
    return this.state.institutionMode === InstitutionMode.EDIT;
  }

  render() {
    const {institution, showOtherInstitutionTextBox, title} = this.state;
    const {
      displayName, organizationTypeEnum, organizationTypeOtherText
    } = institution;

    validate.validators.customEmailAddresses = (accessTierShortName: string) => {
      const tierConfig = getTierConfig(this.state.institution, accessTierShortName);
      if (tierConfig.membershipRequirement === InstitutionMembershipRequirement.ADDRESSES) {
        const addresses = (tierConfig.emailAddresses || []).filter(nonEmpty);
        if (addresses.length === 0) {
          return 'should not be empty';
        }
        const invalid = getInvalidEmailAddresses(addresses);
        if (invalid.length > 0) {
          return 'are not valid: ' + invalid.join(', ');
        }
      }
    };

    validate.validators.customEmailDomains = (accessTierShortName: string) => {
      const tierConfig = getTierConfig(this.state.institution, accessTierShortName);
      if (tierConfig.membershipRequirement === InstitutionMembershipRequirement.DOMAINS) {
        const domains = (tierConfig.emailDomains || []).filter(nonEmpty);
        if (domains.length === 0) {
          return 'should not be empty';
        }
        const invalid = getInvalidEmailDomains(domains);
        if (invalid.length > 0) {
          return 'are not valid: ' + invalid.join(', ');
        }
      }
    };

    const errors = validate({
      displayName,
      organizationTypeEnum,
      'organizationTypeOtherText': (organizationTypeEnum !== OrganizationType.OTHER) || organizationTypeOtherText,
      'registeredTierEmailAddresses': AccessTierShortNames.Registered,
      'controlledTierEmailAddresses': AccessTierShortNames.Controlled,
      'registeredTierEmailDomains': AccessTierShortNames.Registered,
      'controlledTierEmailDomains': AccessTierShortNames.Controlled,
    }, {
      displayName: {presence: {allowEmpty: false}, length: {maximum: 80, tooLong: 'must be %{count} characters or less'}},
      organizationTypeEnum: {presence: {allowEmpty: false}},
      organizationTypeOtherText: {truthiness: true},
      registeredTierEmailAddresses: {customEmailAddresses: {}},
      controlledTierEmailAddresses: {customEmailAddresses: {}},
      registeredTierEmailDomains: {customEmailDomains: {}},
      controlledTierEmailDomains: {customEmailDomains: {}},
    });
    return <div>
      <style>{css}</style>
      <FadeBox style={{marginTop: '1rem', marginLeft: '1rem', width: '1239px'}}>
         <FlexRow>
           <Scroll
              dir='left'
              onClick={() => this.backButton()}
              style={{width: '1.2rem', margin: '0.4rem 0.4rem 0rem 0rem'}}
          /> <SemiBoldHeader style={{fontSize: '18px', lineHeight: '22px', marginBottom: '1rem'}}>
          {title}
          </SemiBoldHeader>
        </FlexRow>
        <FlexRow>
          <FlexColumn style={{width: '50%'}}>
            <TextInputWithLabel
                value={institution.displayName}
                inputId='displayName'
                inputName='displayName'
                placeholder='Display Name'
                labelStyle={styles.label}
                inputStyle={{width: '16rem', marginTop: '0.3rem'}}
                labelText='Institution Name'
                onChange={v => this.setState(fp.set(['institution', 'displayName'], v))}
                onBlur={v => this.setState(fp.set(['institution', 'displayName'], v.trim()))}
            />
            <div style={{color: colors.danger}} data-test-id='displayNameError'>
              {institution.displayName && errors && errors.displayName}
              </div>
            <label style={styles.label}>Institution Type</label>
            <Dropdown style={{width: '16rem'}} data-test-id='organization-dropdown'
                      placeholder='Organization Type'
                      options={OrganizationTypeOptions}
                      value={institution.organizationTypeEnum}
                      onChange={v => this.updateInstitutionRole(v.value)}/>
            {showOtherInstitutionTextBox && <TextInputWithLabel
              value={institution.organizationTypeOtherText}
              onChange={v => this.setState(fp.set(['institution', 'organizationTypeOtherText'], v))}
              onBlur={v => this.setState(fp.set(['institution', 'organizationTypeOtherText'], v.trim()))}
              inputStyle={{width: '16rem', marginTop: '0.8rem'}}/>}
          </FlexColumn>
          <FlexColumn style={{width: '50%', marginRight: '1rem'}}>
            <label style={{...styles.label, marginTop: '0rem'}}>User Email Instructions Text (Optional)</label>
              <TextArea
                id={'userEmailInstructions'}
                value={institution.userInstructions ? institution.userInstructions : ''}
                onChange={(s: string) => this.setState(fp.set(['institution', 'userInstructions'], s))}
              />
            </FlexColumn>
        </FlexRow>
        <SemiBoldHeader style={{fontSize: '18px', lineHeight: '22px', marginTop: '2rem'}}>
          Data access tiers
        </SemiBoldHeader>
        <hr style={{border: '1px solid #A9B6CB'}}/>
        <FlexRow style={{gap: '2rem'}}>
          <TierConfig
              institution={institution}
              accessTierShortName={AccessTierShortNames.Registered}
              TierBadge={() => <RegisteredTierBadge style={styles.tierBadge}/>}
              setEraRequired={(value) => this.setRtRequireEra(value)}
              setTierRequirement={(requirement) => this.setRegisteredTierRequirement(requirement)}
              filterEmptyAddresses={() => this.filterEmptyRtEmailAddresses()}
              setTierAddresses={(addrs) => this.setRegisteredTierEmails(addrs)}
              filterEmptyDomains={() => this.filterEmptyRtEmailDomains()}
              setTierDomains={(domains) => this.setRegisteredTierDomains(domains)}/>
          <TierConfig
              institution={institution}
              accessTierShortName={AccessTierShortNames.Controlled}
              TierBadge={() => <ControlledTierBadge style={styles.tierBadge}/>}
              setEnableControlledTier={(value) => this.setEnableControlledTier(value)}
              setEraRequired={(value) => this.setCtRequireEra(value)}
              setTierRequirement={(requirement) => this.setControlledTierRequirement(requirement)}
              filterEmptyAddresses={() => this.filterEmptyCtEmailAddresses()}
              setTierAddresses={(addrs) => this.setControlledTierEmails(addrs)}
              filterEmptyDomains={() => this.filterEmptyCtEmailDomains()}
              setTierDomains={(domains) => this.setControlledTierDomains(domains)}/>
         </FlexRow>
        <FlexRow style={{justifyContent: 'flex-start', marginRight: '1rem'}}>
          <div>
            <Button type='secondary' path='/admin/institution' style={{marginRight: '1.5rem'}}>Cancel</Button>
            <TooltipTrigger data-test-id='tooltip' content={
              errors && this.disableSave(errors) && <div>Please correct the following errors
                <BulletAlignedUnorderedList>
                  {[errors.displayName,
                    errors.organizationTypeEnum,
                    errors.registeredTierEmailAddresses,
                    errors.registeredTierEmailDomains,
                    errors.controlledTierEmailAddresses,
                    errors.controlledTierEmailDomains
                  ].map(e => e && <li key={e}>{e}</li>)}
                {errors.organizationTypeOtherText && <li>Organization Type 'Other' requires additional information</li>}
                </BulletAlignedUnorderedList>
              </div>
            } disable={this.isAddInstitutionMode}>
              <Button type='primary'
                      data-test-id='save-institution-button'
                      disabled={this.disableSave(errors)}
                      onClick={() => this.saveInstitution()}>
                {this.buttonText}
              </Button>
            </TooltipTrigger>
          </div>
        </FlexRow>
        {this.state.showBackButtonWarning && <SaveErrorModal
            onFinish={() => this.setState({showBackButtonWarning: false})}
            onContinue={() => this.backNavigate()}
        />}
        {this.state.showApiError && <ApiErrorModal
            errorMsg={this.state.apiErrorMsg}
            onClose={() => this.setState({showApiError: false})}/>}
      </FadeBox>
      </div>;
  }
});
