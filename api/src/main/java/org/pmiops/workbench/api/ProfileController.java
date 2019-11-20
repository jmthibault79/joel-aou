package org.pmiops.workbench.api;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import javax.inject.Provider;
import javax.mail.MessagingException;
import javax.mail.internet.AddressException;
import javax.mail.internet.InternetAddress;
import org.pmiops.workbench.actionaudit.adapters.ProfileAuditAdapter;
import org.pmiops.workbench.annotations.AuthorityRequired;
import org.pmiops.workbench.auth.ProfileService;
import org.pmiops.workbench.auth.UserAuthentication;
import org.pmiops.workbench.auth.UserAuthentication.UserType;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.config.WorkbenchEnvironment;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.UserService;
import org.pmiops.workbench.db.model.DbAddress;
import org.pmiops.workbench.db.model.DbDemographicSurvey;
import org.pmiops.workbench.db.model.DbInstitutionalAffiliation;
import org.pmiops.workbench.db.model.DbPageVisit;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.exceptions.ConflictException;
import org.pmiops.workbench.exceptions.EmailException;
import org.pmiops.workbench.exceptions.ForbiddenException;
import org.pmiops.workbench.exceptions.NotFoundException;
import org.pmiops.workbench.exceptions.ServerErrorException;
import org.pmiops.workbench.exceptions.UnauthorizedException;
import org.pmiops.workbench.exceptions.WorkbenchException;
import org.pmiops.workbench.firecloud.FireCloudService;
import org.pmiops.workbench.firecloud.model.BillingProjectMembership.CreationStatusEnum;
import org.pmiops.workbench.firecloud.model.JWTWrapper;
import org.pmiops.workbench.google.CloudStorageService;
import org.pmiops.workbench.google.DirectoryService;
import org.pmiops.workbench.mail.MailService;
import org.pmiops.workbench.model.AccessBypassRequest;
import org.pmiops.workbench.model.Address;
import org.pmiops.workbench.model.Authority;
import org.pmiops.workbench.model.BillingProjectMembership;
import org.pmiops.workbench.model.BillingProjectStatus;
import org.pmiops.workbench.model.ContactEmailTakenResponse;
import org.pmiops.workbench.model.CreateAccountRequest;
import org.pmiops.workbench.model.DemographicSurvey;
import org.pmiops.workbench.model.Disability;
import org.pmiops.workbench.model.EmailVerificationStatus;
import org.pmiops.workbench.model.EmptyResponse;
import org.pmiops.workbench.model.InstitutionalAffiliation;
import org.pmiops.workbench.model.InvitationVerificationRequest;
import org.pmiops.workbench.model.NihToken;
import org.pmiops.workbench.model.PageVisit;
import org.pmiops.workbench.model.Profile;
import org.pmiops.workbench.model.ResendWelcomeEmailRequest;
import org.pmiops.workbench.model.UpdateContactEmailRequest;
import org.pmiops.workbench.model.UserListResponse;
import org.pmiops.workbench.model.UsernameTakenResponse;
import org.pmiops.workbench.moodle.ApiException;
import org.pmiops.workbench.notebooks.LeonardoNotebooksClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.RestController;

/**
 * Contains implementations for all Workbench API methods tagged with "profile".
 *
 * <p>The majority of handlers here are lightweight wrappers which delegate to UserService, where
 * many user-focused database and/or API calls are implemented.
 */
@RestController
public class ProfileController implements ProfileApiDelegate {
  private static final Map<CreationStatusEnum, BillingProjectStatus> fcToWorkbenchBillingMap =
      new ImmutableMap.Builder<CreationStatusEnum, BillingProjectStatus>()
          .put(CreationStatusEnum.CREATING, BillingProjectStatus.PENDING)
          .put(CreationStatusEnum.READY, BillingProjectStatus.READY)
          .put(CreationStatusEnum.ERROR, BillingProjectStatus.ERROR)
          .build();
  private static final Function<
          org.pmiops.workbench.firecloud.model.BillingProjectMembership, BillingProjectMembership>
      TO_CLIENT_BILLING_PROJECT_MEMBERSHIP =
          new Function<
              org.pmiops.workbench.firecloud.model.BillingProjectMembership,
              BillingProjectMembership>() {
            @Override
            public BillingProjectMembership apply(
                org.pmiops.workbench.firecloud.model.BillingProjectMembership
                    billingProjectMembership) {
              BillingProjectMembership result = new BillingProjectMembership();
              result.setProjectName(billingProjectMembership.getProjectName());
              result.setRole(billingProjectMembership.getRole());
              result.setStatus(
                  fcToWorkbenchBillingMap.get(billingProjectMembership.getCreationStatus()));
              return result;
            }
          };
  private static final Function<InstitutionalAffiliation, DbInstitutionalAffiliation>
      FROM_CLIENT_INSTITUTIONAL_AFFILIATION =
          new Function<InstitutionalAffiliation, DbInstitutionalAffiliation>() {
            @Override
            public DbInstitutionalAffiliation apply(
                InstitutionalAffiliation institutionalAffiliation) {
              DbInstitutionalAffiliation result = new DbInstitutionalAffiliation();
              if (institutionalAffiliation.getInstitution() != null) {
                result.setInstitution(institutionalAffiliation.getInstitution());
              }
              if (institutionalAffiliation.getNonAcademicAffiliation() != null) {
                result.setNonAcademicAffiliationnEnum(
                    institutionalAffiliation.getNonAcademicAffiliation());
              }

              result.setRole(institutionalAffiliation.getRole());
              result.setOther(institutionalAffiliation.getOther());

              return result;
            }
          };

  private static final Function<Address, DbAddress> FROM_CLIENT_ADDRESS =
      new Function<Address, DbAddress>() {
        @Override
        public DbAddress apply(Address address) {
          DbAddress result = new DbAddress();
          result.setStreetAddress1(address.getStreetAddress1());
          result.setStreetAddress2(address.getStreetAddress2());
          result.setCity(address.getCity());
          result.setState(address.getState());
          result.setZipCode(address.getZipCode());
          result.setCountry(address.getCountry());
          return result;
        }
      };

  private static final Function<DemographicSurvey, DbDemographicSurvey>
      FROM_CLIENT_DEMOGRAPHIC_SURVEY =
          new Function<DemographicSurvey, DbDemographicSurvey>() {
            @Override
            public DbDemographicSurvey apply(DemographicSurvey demographicSurvey) {
              DbDemographicSurvey result = new DbDemographicSurvey();
              if (demographicSurvey.getRace() != null)
                result.setRaceEnum(demographicSurvey.getRace());
              if (demographicSurvey.getEthnicity() != null)
                result.setEthnicityEnum(demographicSurvey.getEthnicity());
              if (demographicSurvey.getDisability() != null)
                result.setDisabilityEnum(
                    demographicSurvey.getDisability() ? Disability.TRUE : Disability.FALSE);
              if (demographicSurvey.getEducation() != null)
                result.setEducationEnum(demographicSurvey.getEducation());
              if (demographicSurvey.getGender() != null)
                result.setGenderEnum(demographicSurvey.getGender());
              if (demographicSurvey.getDisability() != null)
                result.setDisabilityEnum(
                    demographicSurvey.getDisability() ? Disability.TRUE : Disability.FALSE);
              if (demographicSurvey.getYearOfBirth() != null)
                result.setYear_of_birth(demographicSurvey.getYearOfBirth().intValue());
              return result;
            }
          };

  private static final Logger log = Logger.getLogger(ProfileController.class.getName());

  private static final long MAX_BILLING_PROJECT_CREATION_ATTEMPTS = 5;

  private final ProfileService profileService;
  private final Provider<DbUser> userProvider;
  private final Provider<UserAuthentication> userAuthenticationProvider;
  private final UserDao userDao;
  private final Clock clock;
  private final UserService userService;
  private final FireCloudService fireCloudService;
  private final DirectoryService directoryService;
  private final CloudStorageService cloudStorageService;
  private final LeonardoNotebooksClient leonardoNotebooksClient;
  private final Provider<WorkbenchConfig> workbenchConfigProvider;
  private final WorkbenchEnvironment workbenchEnvironment;
  private final Provider<MailService> mailServiceProvider;
  private final ProfileAuditAdapter profileAuditAdapter;

  @Autowired
  ProfileController(
      ProfileService profileService,
      Provider<DbUser> userProvider,
      Provider<UserAuthentication> userAuthenticationProvider,
      UserDao userDao,
      Clock clock,
      UserService userService,
      FireCloudService fireCloudService,
      DirectoryService directoryService,
      CloudStorageService cloudStorageService,
      LeonardoNotebooksClient leonardoNotebooksClient,
      Provider<WorkbenchConfig> workbenchConfigProvider,
      WorkbenchEnvironment workbenchEnvironment,
      Provider<MailService> mailServiceProvider,
      ProfileAuditAdapter profileAuditAdapter) {
    this.profileService = profileService;
    this.userProvider = userProvider;
    this.userAuthenticationProvider = userAuthenticationProvider;
    this.userDao = userDao;
    this.clock = clock;
    this.userService = userService;
    this.fireCloudService = fireCloudService;
    this.directoryService = directoryService;
    this.cloudStorageService = cloudStorageService;
    this.leonardoNotebooksClient = leonardoNotebooksClient;
    this.workbenchConfigProvider = workbenchConfigProvider;
    this.workbenchEnvironment = workbenchEnvironment;
    this.mailServiceProvider = mailServiceProvider;
    this.profileAuditAdapter = profileAuditAdapter;
  }

  @Override
  public ResponseEntity<List<BillingProjectMembership>> getBillingProjects() {
    List<org.pmiops.workbench.firecloud.model.BillingProjectMembership> memberships =
        fireCloudService.getBillingProjectMemberships();
    return ResponseEntity.ok(
        memberships.stream()
            .map(TO_CLIENT_BILLING_PROJECT_MEMBERSHIP)
            .collect(Collectors.toList()));
  }

  private String createFirecloudUserAndBillingProject(DbUser user) {
    // If the user is already registered, their profile will get updated.
    fireCloudService.registerUser(
        user.getContactEmail(), user.getGivenName(), user.getFamilyName());
    return createFirecloudBillingProject(user);
  }

  private void validateStringLength(String field, String fieldName, int max, int min) {
    if (field == null) {
      throw new BadRequestException(String.format("%s cannot be left blank!", fieldName));
    }
    if (field.length() > max) {
      throw new BadRequestException(
          String.format("%s length exceeds character limit. (%d)", fieldName, max));
    }
    if (field.length() < min) {
      if (min == 1) {
        throw new BadRequestException(String.format("%s cannot be left blank.", fieldName));
      } else {
        throw new BadRequestException(
            String.format("%s is under character minimum. (%d)", fieldName, min));
      }
    }
  }

  private void validateProfileFields(Profile profile) {
    validateStringLength(profile.getGivenName(), "Given Name", 80, 1);
    validateStringLength(profile.getFamilyName(), "Family Name", 80, 1);
    if (!workbenchConfigProvider.get().featureFlags.enableNewAccountCreation) {
      // required for old create account flow
      validateStringLength(profile.getCurrentPosition(), "Current Position", 255, 1);
      validateStringLength(profile.getOrganization(), "Organization", 255, 1);
      validateStringLength(profile.getAreaOfResearch(), "Current Research", 3000, 1);
    }
  }

  private DbUser saveUserWithConflictHandling(DbUser dbUser) {
    try {
      return userDao.save(dbUser);
    } catch (ObjectOptimisticLockingFailureException e) {
      log.log(Level.WARNING, "version conflict for user update", e);
      throw new ConflictException("Failed due to concurrent modification");
    }
  }

  private String createFirecloudBillingProject(DbUser user) {
    WorkbenchConfig workbenchConfig = workbenchConfigProvider.get();
    long suffix;
    if (workbenchEnvironment.isDevelopment()) {
      // For local development, make one billing project per account based on a hash of the account
      // email, and reuse it across database resets. (Assume we won't have any collisions;
      // if we discover that somebody starts using our namespace, change it up.)
      suffix = Math.abs(user.getEmail().hashCode());
    } else {
      // In other environments, create a suffix based on the user ID from the database. We will
      // add a suffix if that billing project is already taken. (If the database is reset, we
      // should consider switching the prefix.)
      suffix = user.getUserId();
    }
    // GCP billing project names must be <= 30 characters. The per-user hash, an integer,
    // is <= 10 chars.
    String billingProjectNamePrefix =
        workbenchConfigProvider.get().billing.projectNamePrefix + suffix;
    String billingProjectName = billingProjectNamePrefix;
    int numAttempts = 0;
    while (numAttempts < MAX_BILLING_PROJECT_CREATION_ATTEMPTS) {
      try {
        fireCloudService.createAllOfUsBillingProject(billingProjectName);
        break;
      } catch (ConflictException e) {
        if (workbenchEnvironment.isDevelopment()) {
          // In local development, just re-use existing projects for the account. (We don't
          // want to create a new billing project every time the database is reset.)
          log.log(
              Level.WARNING,
              String.format(
                  "Project with name '%s' already exists; using it.", billingProjectName));
          break;
        } else {
          numAttempts++;
          // In cloud environments, keep trying billing project names until we find one
          // that hasn't been used before, or we hit MAX_BILLING_PROJECT_CREATION_ATTEMPTS.
          billingProjectName = billingProjectNamePrefix + "-" + numAttempts;
        }
      }
    }
    if (numAttempts == MAX_BILLING_PROJECT_CREATION_ATTEMPTS) {
      throw new ServerErrorException(
          String.format(
              "Encountered %d billing project name " + "collisions; giving up",
              MAX_BILLING_PROJECT_CREATION_ATTEMPTS));
    }

    try {
      // If the user is already a member of the billing project, this will have no effect.
      fireCloudService.addUserToBillingProject(user.getEmail(), billingProjectName);
    } catch (ForbiddenException e) {
      // AofU is not the owner of the billing project. This should only happen in local
      // environments (and hopefully never, given the prefix we're using.) If it happens,
      // we may need to pick a different prefix.
      log.log(
          Level.SEVERE,
          String.format(
              "Unable to add user to billing project %s; "
                  + "consider changing billing project prefix",
              billingProjectName),
          e);
      throw new ServerErrorException("Unable to add user to billing project", e);
    }
    return billingProjectName;
  }

  private DbUser initializeUserIfNeeded() {
    UserAuthentication userAuthentication = userAuthenticationProvider.get();
    DbUser dbUser = userAuthentication.getUser();
    if (userAuthentication.getUserType() == UserType.SERVICE_ACCOUNT) {
      // Service accounts don't need further initialization.
      return dbUser;
    }

    // On first sign-in, create a FC user, billing project, and set the first sign in time.
    if (dbUser.getFirstSignInTime() == null) {
      // If the user is already registered, their profile will get updated.
      fireCloudService.registerUser(
          dbUser.getContactEmail(), dbUser.getGivenName(), dbUser.getFamilyName());

      dbUser.setFirstSignInTime(new Timestamp(clock.instant().toEpochMilli()));
      // If the user is logged in, then we know that they have followed the account creation
      // instructions sent to
      // their initial contact email address.
      dbUser.setEmailVerificationStatusEnum(EmailVerificationStatus.SUBSCRIBED);
      return saveUserWithConflictHandling(dbUser);
    }

    return dbUser;
  }

  private ResponseEntity<Profile> getProfileResponse(DbUser user) {
    Profile profile = profileService.getProfile(user);
    // Note: The following requires that the current request is authenticated.
    return ResponseEntity.ok(profile);
  }

  @Override
  public ResponseEntity<Profile> getMe() {
    // Record that the user signed in, and create the user's FireCloud user and free tier billing
    // project if they haven't been created already.
    // This means they can start using the NIH billing account in FireCloud (without access to
    // the CDR); we will probably need a job that deactivates accounts after some period of
    // not accepting the terms of use.

    DbUser dbUser = initializeUserIfNeeded();
    profileAuditAdapter.fireLoginAction(dbUser);
    return getProfileResponse(dbUser);
  }

  @Override
  public ResponseEntity<UsernameTakenResponse> isUsernameTaken(String username) {
    return ResponseEntity.ok(
        new UsernameTakenResponse().isTaken(directoryService.isUsernameTaken(username)));
  }

  @Override
  public ResponseEntity<ContactEmailTakenResponse> isContactEmailTaken(String contactEmail) {
    return ResponseEntity.ok(
        new ContactEmailTakenResponse().isTaken(userService.getContactEmailTaken(contactEmail)));
  }

  @Override
  public ResponseEntity<Profile> createAccount(CreateAccountRequest request) {
    verifyInvitationKey(request.getInvitationKey());
    String userName = request.getProfile().getUsername();
    if (userName == null || userName.length() < 3 || userName.length() > 64)
      throw new BadRequestException(
          "Username should be at least 3 characters and not more than 64 characters");
    request.getProfile().setUsername(request.getProfile().getUsername().toLowerCase());
    validateProfileFields(request.getProfile());
    // This check will be removed once enableNewAccountCreation flag is turned on.
    if (request.getProfile().getAddress() == null) {
      request.getProfile().setAddress(new Address());
    }
    if (request.getProfile().getDemographicSurvey() == null) {
      request.getProfile().setDemographicSurvey(new DemographicSurvey());
    }
    if (request.getProfile().getInstitutionalAffiliations() == null) {
      request.getProfile().setInstitutionalAffiliations(new ArrayList<InstitutionalAffiliation>());
    }
    com.google.api.services.directory.model.User googleUser =
        directoryService.createUser(
            request.getProfile().getGivenName(),
            request.getProfile().getFamilyName(),
            request.getProfile().getUsername(),
            request.getProfile().getContactEmail());

    // Create a user that has no data access or FC user associated.
    // We create this account before they sign in so we can keep track of which users we have
    // created Google accounts for. This can be used subsequently to delete orphaned accounts.

    // We store this information in our own database so that:
    // 1) we can support bring-your-own account in future (when we won't be using directory service)
    // 2) we can easily generate lists of researchers for the storefront, without joining to Google

    // It's possible for the profile information to become out of sync with the user's Google
    // profile, since it can be edited in our UI as well as the Google UI,  and we're fine with
    // that; the expectation is their profile in AofU will be managed in AofU, not in Google.

    DbUser user =
        userService.createUser(
            request.getProfile().getGivenName(),
            request.getProfile().getFamilyName(),
            googleUser.getPrimaryEmail(),
            request.getProfile().getContactEmail(),
            request.getProfile().getCurrentPosition(),
            request.getProfile().getOrganization(),
            request.getProfile().getAreaOfResearch(),
            FROM_CLIENT_ADDRESS.apply(request.getProfile().getAddress()),
            FROM_CLIENT_DEMOGRAPHIC_SURVEY.apply(request.getProfile().getDemographicSurvey()),
            request.getProfile().getInstitutionalAffiliations().stream()
                .map(FROM_CLIENT_INSTITUTIONAL_AFFILIATION)
                .collect(Collectors.toList()));

    try {
      mailServiceProvider
          .get()
          .sendWelcomeEmail(
              request.getProfile().getContactEmail(), googleUser.getPassword(), googleUser);
    } catch (MessagingException e) {
      throw new WorkbenchException(e);
    }
    // Note: Avoid getProfileResponse() here as this is not an authenticated request.
    final Profile createdProfile = profileService.getProfile(user);
    profileAuditAdapter.fireCreateAction(createdProfile);
    return ResponseEntity.ok(createdProfile);
  }

  @Override
  public ResponseEntity<Profile> requestBetaAccess() {
    Timestamp now = new Timestamp(clock.instant().toEpochMilli());
    DbUser user = userProvider.get();
    if (user.getBetaAccessRequestTime() == null) {
      log.log(Level.INFO, "Sending beta access request email.");
      try {
        mailServiceProvider.get().sendBetaAccessRequestEmail(user.getEmail());
      } catch (MessagingException e) {
        throw new EmailException("Error submitting beta access request", e);
      }
      user.setBetaAccessRequestTime(now);
      user = saveUserWithConflictHandling(user);
    }
    return getProfileResponse(user);
  }

  @Override
  public ResponseEntity<Profile> submitDemographicsSurvey() {
    // TODO: RW-2517.
    return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
  }

  @Override
  public ResponseEntity<Profile> submitDataUseAgreement(
      Integer dataUseAgreementSignedVersion, String initials) {
    DbUser user =
        userService.submitDataUseAgreement(
            userProvider.get(), dataUseAgreementSignedVersion, initials);
    return getProfileResponse(saveUserWithConflictHandling(user));
  }

  /**
   * This methods updates logged in user's training status from Moodle.
   *
   * @return Profile updated with training completion time
   */
  public ResponseEntity<Profile> syncComplianceTrainingStatus() {
    try {
      userService.syncComplianceTrainingStatus();
    } catch (NotFoundException ex) {
      throw ex;
    } catch (ApiException e) {
      throw new ServerErrorException(e);
    }
    return getProfileResponse(userProvider.get());
  }

  @Override
  public ResponseEntity<Profile> syncEraCommonsStatus() {
    userService.syncEraCommonsStatus();
    return getProfileResponse(userProvider.get());
  }

  @Override
  public ResponseEntity<Profile> syncTwoFactorAuthStatus() {
    userService.syncTwoFactorAuthStatus();
    return getProfileResponse(userProvider.get());
  }

  @Override
  public ResponseEntity<Void> invitationKeyVerification(
      InvitationVerificationRequest invitationVerificationRequest) {
    verifyInvitationKey(invitationVerificationRequest.getInvitationKey());
    return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
  }

  private void verifyInvitationKey(String invitationKey) {
    if (invitationKey == null
        || invitationKey.equals("")
        || !invitationKey.equals(cloudStorageService.readInvitationKey())) {
      throw new BadRequestException(
          "Missing or incorrect invitationKey (this API is not yet publicly launched)");
    }
  }

  private void checkUserCreationNonce(DbUser user, String nonce) {
    if (Strings.isNullOrEmpty(nonce)) {
      throw new BadRequestException("missing required creationNonce");
    }
    if (user.getCreationNonce() == null || !nonce.equals(user.getCreationNonce().toString())) {
      throw new UnauthorizedException("invalid creationNonce provided");
    }
  }

  /*
   * This un-authed API method is limited such that we only allow contact email updates before the user has signed in
   * with the newly created gsuite account. Once the user has logged in, they can change their contact email through
   * the normal profile update process.
   */
  @Override
  public ResponseEntity<Void> updateContactEmail(
      UpdateContactEmailRequest updateContactEmailRequest) {
    String username = updateContactEmailRequest.getUsername().toLowerCase();
    com.google.api.services.directory.model.User googleUser = directoryService.getUser(username);
    DbUser user = userDao.findUserByEmail(username);
    checkUserCreationNonce(user, updateContactEmailRequest.getCreationNonce());
    if (userHasEverLoggedIn(googleUser, user)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    String newEmail = updateContactEmailRequest.getContactEmail();
    try {
      new InternetAddress(newEmail).validate();
    } catch (AddressException e) {
      log.log(Level.INFO, "Invalid email entered.");
      return ResponseEntity.badRequest().build();
    }
    user.setContactEmail(newEmail);
    return resetPasswordAndSendWelcomeEmail(username, user);
  }

  @Override
  public ResponseEntity<Void> resendWelcomeEmail(ResendWelcomeEmailRequest resendRequest) {
    String username = resendRequest.getUsername().toLowerCase();
    com.google.api.services.directory.model.User googleUser = directoryService.getUser(username);
    DbUser user = userDao.findUserByEmail(username);
    checkUserCreationNonce(user, resendRequest.getCreationNonce());
    if (userHasEverLoggedIn(googleUser, user)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    return resetPasswordAndSendWelcomeEmail(username, user);
  }

  private boolean userHasEverLoggedIn(
      com.google.api.services.directory.model.User googleUser, DbUser user) {
    return user.getFirstSignInTime() != null || !googleUser.getChangePasswordAtNextLogin();
  }

  private ResponseEntity<Void> resetPasswordAndSendWelcomeEmail(String username, DbUser user) {
    com.google.api.services.directory.model.User googleUser =
        directoryService.resetUserPassword(username);
    try {
      mailServiceProvider
          .get()
          .sendWelcomeEmail(user.getContactEmail(), googleUser.getPassword(), googleUser);
    } catch (MessagingException e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
    }
    return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
  }

  @Override
  public ResponseEntity<Profile> updatePageVisits(PageVisit newPageVisit) {
    DbUser dbUser = userProvider.get();
    dbUser = userDao.findUserWithAuthoritiesAndPageVisits(dbUser.getUserId());
    Timestamp timestamp = Timestamp.from(clock.instant());
    final boolean shouldAdd =
        dbUser.getPageVisits().stream()
            .noneMatch(v -> v.getPageId().equals(newPageVisit.getPage()));
    if (shouldAdd) {
      final DbPageVisit firstPageVisit = new DbPageVisit();
      firstPageVisit.setPageId(newPageVisit.getPage());
      firstPageVisit.setUser(dbUser);
      firstPageVisit.setFirstVisit(timestamp);
      dbUser.getPageVisits().add(firstPageVisit);
      dbUser = userDao.save(dbUser);
    }
    return getProfileResponse(saveUserWithConflictHandling(dbUser));
  }

  @Override
  public ResponseEntity<Void> updateProfile(Profile updatedProfile) {
    validateProfileFields(updatedProfile);
    DbUser user = userProvider.get();

    // Save current profile for audit trail. Continue to use the userProvider (instead
    // of info on previousProfile) to ensure addition of audit system doesn't change behavior.
    // That is, in the (rare, hopefully) condition that the old profile gives incorrect information,
    // the update will still work as well as it would have.
    final Profile previousProfile = profileService.getProfile(user);

    if (!userProvider.get().getGivenName().equalsIgnoreCase(updatedProfile.getGivenName())
        || !userProvider.get().getFamilyName().equalsIgnoreCase(updatedProfile.getFamilyName())) {
      userService.setDataUseAgreementNameOutOfDate(
          updatedProfile.getGivenName(), updatedProfile.getFamilyName());
    }

    user.setGivenName(updatedProfile.getGivenName());
    user.setFamilyName(updatedProfile.getFamilyName());
    user.setOrganization(updatedProfile.getOrganization());
    user.setCurrentPosition(updatedProfile.getCurrentPosition());
    user.setAboutYou(updatedProfile.getAboutYou());
    user.setAreaOfResearch(updatedProfile.getAreaOfResearch());

    if (updatedProfile.getContactEmail() != null
        && !updatedProfile.getContactEmail().equals(user.getContactEmail())) {
      // See RW-1488.
      throw new BadRequestException("Changing email is not currently supported");
    }
    List<DbInstitutionalAffiliation> newAffiliations =
        updatedProfile.getInstitutionalAffiliations().stream()
            .map(FROM_CLIENT_INSTITUTIONAL_AFFILIATION)
            .collect(Collectors.toList());
    int i = 0;
    ListIterator<DbInstitutionalAffiliation> oldAffilations =
        user.getInstitutionalAffiliations().listIterator();
    boolean shouldAdd = false;
    if (newAffiliations.size() == 0) {
      shouldAdd = true;
    }
    for (DbInstitutionalAffiliation affiliation : newAffiliations) {
      affiliation.setOrderIndex(i);
      affiliation.setUser(user);
      if (oldAffilations.hasNext()) {
        DbInstitutionalAffiliation oldAffilation = oldAffilations.next();
        if (!oldAffilation.getRole().equals(affiliation.getRole())
            || !oldAffilation.getInstitution().equals(affiliation.getInstitution())) {
          shouldAdd = true;
        }
      } else {
        shouldAdd = true;
      }
      i++;
    }
    if (oldAffilations.hasNext()) {
      shouldAdd = true;
    }
    if (shouldAdd) {
      user.clearInstitutionalAffiliations();
      for (DbInstitutionalAffiliation affiliation : newAffiliations) {
        user.addInstitutionalAffiliation(affiliation);
      }
    }

    // This does not update the name in Google.
    saveUserWithConflictHandling(user);

    final Profile appliedUpdatedProfile = profileService.getProfile(user);
    profileAuditAdapter.fireUpdateAction(previousProfile, appliedUpdatedProfile);

    return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
  }

  @Override
  @AuthorityRequired({Authority.ACCESS_CONTROL_ADMIN})
  public ResponseEntity<UserListResponse> getAllUsers() {
    UserListResponse response = new UserListResponse();
    List<Profile> responseList = new ArrayList<>();
    for (DbUser user : userDao.findUsers()) {
      responseList.add(profileService.getProfile(user));
    }
    response.setProfileList(responseList);
    return ResponseEntity.ok(response);
  }

  @Override
  @AuthorityRequired({Authority.ACCESS_CONTROL_ADMIN})
  public ResponseEntity<Profile> getUser(Long userId) {
    DbUser user = userDao.findUserByUserId(userId);
    return ResponseEntity.ok(profileService.getProfile(user));
  }

  @Override
  @AuthorityRequired({Authority.ACCESS_CONTROL_ADMIN})
  public ResponseEntity<EmptyResponse> bypassAccessRequirement(
      Long userId, AccessBypassRequest request) {
    updateBypass(userId, request);
    return ResponseEntity.ok(new EmptyResponse());
  }

  @Override
  public ResponseEntity<EmptyResponse> unsafeSelfBypassAccessRequirement(
      AccessBypassRequest request) {
    if (!workbenchConfigProvider.get().access.unsafeAllowSelfBypass) {
      throw new ForbiddenException("Self bypass is disallowed in this environment.");
    }
    long userId = userProvider.get().getUserId();
    updateBypass(userId, request);
    return ResponseEntity.ok(new EmptyResponse());
  }

  @Override
  public ResponseEntity<Profile> updateNihToken(NihToken token) {
    if (token == null || token.getJwt() == null) {
      throw new BadRequestException("Token is required.");
    }
    JWTWrapper wrapper = new JWTWrapper().jwt(token.getJwt());
    try {
      fireCloudService.postNihCallback(wrapper);
      userService.syncEraCommonsStatus();
      return getProfileResponse(userProvider.get());
    } catch (WorkbenchException e) {
      throw e;
    }
  }

  private void updateBypass(long userId, AccessBypassRequest request) {
    Timestamp valueToSet;
    Timestamp previousValue;
    Boolean bypassed = request.getIsBypassed();
    DbUser user = userDao.findUserByUserId(userId);
    if (bypassed) {
      valueToSet = new Timestamp(clock.instant().toEpochMilli());
    } else {
      valueToSet = null;
    }
    switch (request.getModuleName()) {
      case DATA_USE_AGREEMENT:
        previousValue = user.getDataUseAgreementBypassTime();
        userService.setDataUseAgreementBypassTime(userId, valueToSet);
        break;
      case COMPLIANCE_TRAINING:
        previousValue = user.getComplianceTrainingBypassTime();
        userService.setComplianceTrainingBypassTime(userId, valueToSet);
        break;
      case BETA_ACCESS:
        previousValue = user.getBetaAccessBypassTime();
        userService.setBetaAccessBypassTime(userId, valueToSet);
        break;
      case ERA_COMMONS:
        previousValue = user.getEraCommonsBypassTime();
        userService.setEraCommonsBypassTime(userId, valueToSet);
        break;
      case TWO_FACTOR_AUTH:
        previousValue = user.getTwoFactorAuthBypassTime();
        userService.setTwoFactorAuthBypassTime(userId, valueToSet);
        break;
      default:
        throw new BadRequestException(
            "There is no access module named: " + request.getModuleName().toString());
    }
    userService.logAdminUserAction(
        userId,
        "set bypass status for module " + request.getModuleName().toString() + " to " + bypassed,
        previousValue,
        valueToSet);
  }

  @Override
  public ResponseEntity<Void> deleteProfile() {
    if (!workbenchConfigProvider.get().featureFlags.unsafeAllowDeleteUser) {
      throw new ForbiddenException("Self account deletion is disallowed in this environment.");
    }
    DbUser user = userProvider.get();
    log.log(Level.WARNING, "Deleting profile: user email: " + user.getEmail());
    directoryService.deleteUser(user.getEmail().split("@")[0]);
    userDao.delete(user.getUserId());
    profileAuditAdapter.fireDeleteAction(
        user.getUserId(), user.getEmail()); // not sure if user profider will survive the next line

    return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
  }
}
