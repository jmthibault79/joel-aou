package org.pmiops.workbench.firecloud;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;
import java.util.Map;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACL;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceACLUpdate;
import org.pmiops.workbench.firecloud.model.FirecloudWorkspaceAccessEntry;
import org.pmiops.workbench.model.WorkspaceAccessLevel;

/** Static utilities relating to transforming Firecloud API responses. */
public final class FirecloudTransforms {
  private FirecloudTransforms() {}

  /**
   * Swagger Java codegen does not handle the WorkspaceACL model correctly; it returns a GSON map
   * instead. Run this through a typed Gson conversion process to coerce it into the desired type.
   */
  public static Map<String, FirecloudWorkspaceAccessEntry> extractAclResponse(
      FirecloudWorkspaceACL aclResp) {
    Type accessEntryType = new TypeToken<Map<String, FirecloudWorkspaceAccessEntry>>() {}.getType();
    Gson gson = new Gson();
    return gson.fromJson(gson.toJson(aclResp.getAcl(), accessEntryType), accessEntryType);
  }

  public static FirecloudWorkspaceACLUpdate buildAclUpdate(
      String email, WorkspaceAccessLevel updatedAccess) {
    FirecloudWorkspaceACLUpdate update = new FirecloudWorkspaceACLUpdate().email(email);
    if (updatedAccess == WorkspaceAccessLevel.OWNER) {
      return update
          .canShare(true)
          .canCompute(true)
          .accessLevel(WorkspaceAccessLevel.OWNER.toString());
    } else if (updatedAccess == WorkspaceAccessLevel.WRITER) {
      return update
          .canShare(false)
          .canCompute(true)
          .accessLevel(WorkspaceAccessLevel.WRITER.toString());
    } else if (updatedAccess == WorkspaceAccessLevel.READER) {
      return update
          .canShare(false)
          .canCompute(false)
          .accessLevel(WorkspaceAccessLevel.READER.toString());
    } else {
      return update
          .canShare(false)
          .canCompute(false)
          .accessLevel(WorkspaceAccessLevel.NO_ACCESS.toString());
    }
  }
}
