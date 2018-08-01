import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';

import {ServerConfigService} from '../../services/server-config.service';
import {InvitationKeyComponent} from '../invitation-key/component';
import {LoginComponent} from '../login/component';

import {DataAccessLevel} from 'generated';
import {Profile} from 'generated';
import {ProfileService} from 'generated';
import {CreateAccountRequest} from 'generated';

function isBlank(s: string) {
  return (!s || /^\s*$/.test(s));
}

@Component({
  selector: 'app-account-creation',
  templateUrl: './component.html',
  styleUrls: ['../../styles/template.css',
              './component.css']
})
export class AccountCreationComponent implements AfterViewInit {
  profile: Profile = {
    username: '',
    enabledInFireCloud: false,
    dataAccessLevel: DataAccessLevel.Unregistered,
    givenName: '',
    familyName: '',
    contactEmail: ''
  };
  showAllFieldsRequiredError: boolean;
  creatingAccount: boolean;
  accountCreated: boolean;
  usernameConflictError = false;
  gsuiteDomain: string;
  usernameFocused = false;
  usernameCheckTimeout: NodeJS.Timer;
  usernameCheckInProgress = false;

  @ViewChild('infoIcon') infoIcon: ElementRef;

  // TODO: Injecting the parent component is a bad separation of concerns, as
  // well as injecting LoginComponent. Should look at refactoring these
  // interactions.
  constructor(
    private profileService: ProfileService,
    private invitationKeyService: InvitationKeyComponent,
    private loginComponent: LoginComponent,
    serverConfigService: ServerConfigService
  ) {
    serverConfigService.getConfig().subscribe((config) => {
      this.gsuiteDomain = config.gsuiteDomain;
    });
    // This is a workaround for ExpressionChangedAfterItHasBeenCheckedError from angular
    setTimeout(() => {
      this.loginComponent.smallerBackgroundImgSrc =
          '/assets/images/create-account-male-standing.png';
      this.loginComponent.backgroundImgSrc = '/assets/images/create-account-male.png';
    }, 0);
  }

  ngAfterViewInit(): void {
    // This is necessary to avoid clarity, because clarity's tooltip library
    // automatically sets tabindex to 0.
    this.infoIcon.nativeElement.tabIndex = -1;
  }

  createAccount(): void {
    if (this.usernameConflictError || this.usernameInvalidError) {
      return;
    }
    this.showAllFieldsRequiredError = false;
    const requiredFields =
        [this.profile.givenName, this.profile.familyName,
         this.profile.username, this.profile.contactEmail];
    if (requiredFields.some(isBlank)) {
      this.showAllFieldsRequiredError = true;
      return;
    } else if (this.isUsernameValidationError) {
      return;
    }

    const request: CreateAccountRequest = {
      profile: this.profile,
      invitationKey: this.invitationKeyService.invitationKey
    };
    this.creatingAccount = true;
    this.profileService.createAccount(request).subscribe(() => {
      this.creatingAccount = false;
      this.accountCreated = true;
    }, () => {
      this.creatingAccount = false;
    });
  }

  get usernameInvalidError(): boolean {
    const username = this.profile.username;
    if (isBlank(username)) {
      return false;
    }
    if (username.trim().length > 64) {
      return true;
    }
    // Include alphanumeric characters, -'s, _'s, apostrophes, and single .'s in a row.
    if (username.includes('..') || username.endsWith('.')) {
      return true;
    }
    return !(new RegExp(/^[\w'-][\w.'-]*$/).test(username));
  }

  usernameChanged(): void {
    this.usernameConflictError = false;
    // TODO: This should use a debounce, rather than manual setTimeout()s.
    clearTimeout(this.usernameCheckTimeout);
    this.usernameCheckInProgress = true;
    this.usernameCheckTimeout = setTimeout(() => {
      if (!this.profile.username.trim()) {
        this.usernameCheckInProgress = false;
        return;
      }
      this.profileService.isUsernameTaken(this.profile.username).subscribe((response) => {
        this.usernameCheckInProgress = false;
        this.usernameConflictError = response.isTaken;
      }, () => {
        this.usernameCheckInProgress = false;
      });
    }, 300);
  }

  leaveFocusUsername(): void {
    this.usernameFocused = false;
  }

  enterFocusUsername(): void {
    this.usernameFocused = true;
  }

  get isUsernameValidationError(): boolean {
    return this.usernameConflictError || this.usernameInvalidError;
  }

  get showUsernameValidationError(): boolean {
    if (isBlank(this.profile.username) || this.usernameCheckInProgress) {
      return false;
    }
    return this.isUsernameValidationError;
  }

  get showUsernameValidationSuccess(): boolean {
    if (isBlank(this.profile.username) || this.usernameFocused || this.usernameCheckInProgress) {
      return false;
    }
    return !this.isUsernameValidationError;
  }
}
