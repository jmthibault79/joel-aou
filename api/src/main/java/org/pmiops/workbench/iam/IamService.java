package org.pmiops.workbench.iam;

import java.util.List;

public interface IamService {
  /**
   * Grants user permissions to run Google Life Sciences jobs to the user in the current context.
   *
   * <p>The user's Terra PET service account will get: lifesciences.workflowsRunner and
   * serviceAccountUser (on the petSA itself).
   */
  void grantWorkflowRunnerRoleToCurrentUser(String googleProject);

  /**
   * Grants permissions to run Google Life Sciences jobs for the provided user email lists.
   *
   * <p>The users' Terra PET service accounts will get: lifesciences.workflowsRunner and
   * serviceAccountUser (on the petSA itself).
   *
   * @return the list of users whose workflow runner roles we failed to grant, if any
   */
  List<String> grantWorkflowRunnerRoleForUsers(String googleProject, List<String> userEmails);

  /**
   * Revokes permissions to run Google Life Sciences jobs for the provided user email lists.
   *
   * <p>For now just revoke lifesciences.workflowsRunner permission but keep petSA ActAS permission.
   *
   * @return the list of users whose workflow runner roles we failed to revoke, if any
   */
  List<String> revokeWorkflowRunnerRoleForUsers(String googleProject, List<String> userEmails);
}
