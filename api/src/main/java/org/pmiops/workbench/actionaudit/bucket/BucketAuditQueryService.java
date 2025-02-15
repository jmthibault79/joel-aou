package org.pmiops.workbench.actionaudit.bucket;

import java.util.List;
import org.pmiops.workbench.exfiltration.ExfiltrationConstants;

public interface BucketAuditQueryService {

  /**
   * Query BQ for file information of a specific bucket grouped by the pet account, project ID and
   * bucket. The query retrieves entries that exceed the threshold in {@link ExfiltrationConstants}
   *
   * @return A Map of entries containing the pet account and the sum of the length of the created
   *     files for each pet account, project ID and bucket
   */
  List<BucketAuditEntry> queryBucketFileInformationGroupedByPetAccount();
}
