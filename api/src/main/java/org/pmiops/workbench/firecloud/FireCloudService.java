package org.pmiops.workbench.firecloud;

import com.google.common.annotations.VisibleForTesting;
import java.util.List;
import java.util.Optional;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.firecloud.model.FirecloudBillingProjectStatus;
import org.pmiops.workbench.firecloud.model.FirecloudManagedGroupWithMembers;
import org.pmiops.workbench.firecloud.model.FirecloudMe;
import org.pmiops.workbench.firecloud.model.FirecloudNihStatus;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACL;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACLUpdate;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACLUpdateResponseList;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceDetails;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceResponse;
import org.pmiops.workbench.utils.RandomUtils;

/**
 * Encapsulate Firecloud API interaction details and provide a simple/mockable interface for
 * internal use.
 */
public interface FireCloudService {

  String WORKSPACE_DELIMITER = "__";

  /** Returns the base path for the FireCloud API. Exposed for integration testing purposes only. */
  @VisibleForTesting
  String getApiBasePath();

  /** @return true if firecloud is okay, false if firecloud is down. */
  boolean getFirecloudStatus();

  /** @return the FireCloud profile for the requesting user. */
  FirecloudMe getMe();

  /**
   * Registers the user in Firecloud.
   *
   * @param firstName the user's first name
   * @param lastName the user's last name
   */
  void registerUser(String firstName, String lastName);

  /** Creates a billing project owned by AllOfUs. */
  String createAllOfUsBillingProject(String billingProjectName, String servicePerimeter);

  void deleteBillingProject(String billingProjectName);

  /** Get Billing Project Status */
  FirecloudBillingProjectStatus getBillingProjectStatus(String billingProjectName);

  /** Adds the specified user as an owner to the specified billing project. */
  void addOwnerToBillingProject(String ownerEmail, String billingProjectName);

  /**
   * Removes the specified user as an owner from the specified billing project. Since FireCloud
   * users cannot remove themselves, we need to supply the credential of a different user which will
   * retain ownership to make the call.
   *
   * <p>The call is made by the SA by default. An optional callerAccessToken can be passed in to use
   * that as the caller instead.
   */
  void removeOwnerFromBillingProject(
      String ownerEmailToRemove, String projectName, Optional<String> callerAccessToken);

  int NUM_RANDOM_CHARS = 20;
  String RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz";

  static String toFirecloudName(String workbenchName) {
    // Derive a firecloud-compatible name from the provided name.
    String strippedName = workbenchName.toLowerCase().replaceAll("[^0-9a-z]", "");
    // If the stripped name has no chars, generate a random name.
    if (strippedName.isEmpty()) {
      strippedName = RandomUtils.generateRandomChars(RANDOM_CHARS, NUM_RANDOM_CHARS);
    }
    return strippedName;
  }

  /** Creates a new FC workspace. */
  FirecloudWorkspaceDetails createWorkspace(
      String workspaceNamespace, String workspaceName, String authDomainName);

  FirecloudWorkspaceDetails cloneWorkspace(
      String fromWorkspaceNamespace,
      String fromFirecloudName,
      String toWorkspaceNamespace,
      String toFirecloudName,
      String authDomainName);

  FirecloudWorkspaceACL getWorkspaceAclAsService(String workspaceNamespace, String firecloudName);

  /**
   * Make a Terra PATCH request with a list of ACL update requests for a specific workspace. Only
   * makes the changes specified. Choose the access level "NO ACCESS" to remove access.
   *
   * @param workspaceNamespace the Namespace (Terra Billing Project) of the Workspace to modify
   * @param firecloudName the Terra Name of the Workspace to modify
   * @param aclUpdates
   * @return
   */
  FirecloudWorkspaceACLUpdateResponseList updateWorkspaceACL(
      String workspaceNamespace,
      String firecloudName,
      List<FirecloudWorkspaceACLUpdate> aclUpdates);

  FirecloudWorkspaceResponse getWorkspaceAsService(String workspaceNamespace, String firecloudName);

  /**
   * Requested field options specified here:
   * https://docs.google.com/document/d/1YS95Q7ViRztaCSfPK-NS6tzFPrVpp5KUo0FaWGx7VHw/edit#heading=h.xgjl2srtytjt
   */
  FirecloudWorkspaceResponse getWorkspace(String workspaceNamespace, String firecloudName);

  Optional<FirecloudWorkspaceResponse> getWorkspace(DbWorkspace dbWorkspace);

  List<FirecloudWorkspaceResponse> getWorkspaces();

  void deleteWorkspace(String workspaceNamespace, String firecloudName);

  FirecloudManagedGroupWithMembers getGroup(String groupName);

  FirecloudManagedGroupWithMembers createGroup(String groupName);

  void addUserToGroup(String email, String groupName);

  void removeUserFromGroup(String email, String groupName);

  boolean isUserMemberOfGroupWithCache(String email, String groupName);

  String staticNotebooksConvert(byte[] notebook);

  /** Update billing account using end user credential. */
  void updateBillingAccount(String billingProjectName, String billingAccount);

  /** Update billing account using APP's service account. */
  void updateBillingAccountAsService(String billingProjectName, String billingAccount);

  /**
   * Fetches the status of the currently-authenticated user's linkage to NIH's eRA Commons system.
   *
   * <p>Returns null if the FireCloud user is not found or if the user has no NIH linkage.
   */
  FirecloudNihStatus getNihStatus();

  /** Creates a random Billing Project name. */
  String createBillingProjectName();

  boolean workspaceFileTransferComplete(String workspaceNamespace, String fireCloudName);

  void acceptTermsOfService();

  boolean getUserTermsOfServiceStatus() throws ApiException;
}
