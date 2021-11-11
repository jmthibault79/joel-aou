package org.pmiops.workbench.api;

import com.google.common.base.Joiner;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import java.util.Set;
import java.util.stream.Collectors;
import org.pmiops.workbench.annotations.AuthorityRequired;
import org.pmiops.workbench.db.dao.EgressEventDao;
import org.pmiops.workbench.db.dao.UserDao;
import org.pmiops.workbench.db.dao.WorkspaceDao;
import org.pmiops.workbench.db.model.DbEgressEvent;
import org.pmiops.workbench.db.model.DbEgressEvent.DbEgressEventStatus;
import org.pmiops.workbench.db.model.DbUser;
import org.pmiops.workbench.db.model.DbWorkspace;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.exceptions.FailedPreconditionException;
import org.pmiops.workbench.exceptions.NotFoundException;
import org.pmiops.workbench.model.Authority;
import org.pmiops.workbench.model.EgressEvent;
import org.pmiops.workbench.model.EgressEventStatus;
import org.pmiops.workbench.model.ListEgressEventsRequest;
import org.pmiops.workbench.model.ListEgressEventsResponse;
import org.pmiops.workbench.model.UpdateEgressEventRequest;
import org.pmiops.workbench.utils.PaginationToken;
import org.pmiops.workbench.utils.mappers.EgressEventMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EgressEventsAdminController implements EgressEventsAdminApiDelegate {
  private static final int DEFAULT_PAGE_SIZE = 32;
  private static final int MAX_PAGE_SIZE = 128;

  // Admins can update to/from this set of statuses exclusively.
  private static final Set<EgressEventStatus> updateableStatuses =
      ImmutableSet.of(EgressEventStatus.REMEDIATED, EgressEventStatus.VERIFIED_FALSE_POSITIVE);

  @Autowired private EgressEventMapper egressEventMapper;
  @Autowired private UserDao userDao;
  @Autowired private WorkspaceDao workspaceDao;
  @Autowired private EgressEventDao egressEventDao;

  @AuthorityRequired(Authority.SECURITY_ADMIN)
  @Override
  public ResponseEntity<ListEgressEventsResponse> listEgressEvents(
      ListEgressEventsRequest request) {
    int pageSize = DEFAULT_PAGE_SIZE;
    if (request.getPageSize() != null && request.getPageSize().intValue() > 0) {
      pageSize = Math.min(request.getPageSize().intValue(), MAX_PAGE_SIZE);
    }

    Pageable pageable = PageRequest.of(0, pageSize);
    if (!Strings.isNullOrEmpty(request.getPageToken())) {
      PaginationToken token = PaginationToken.fromBase64(request.getPageToken());
      if (!token.matchesParameters(toPaginationParams(request))) {
        throw new BadRequestException("search parameters changed between paginated calls");
      }
      pageable = PageRequest.of((int) token.getOffset(), pageSize);
    }

    DbUser userFilter = null;
    if (!Strings.isNullOrEmpty((request.getSourceUserEmail()))) {
      userFilter = userDao.findUserByUsername(request.getSourceUserEmail());
      if (userFilter == null) {
        throw new NotFoundException(
            String.format("user '%s' not found", request.getSourceUserEmail()));
      }
    }

    DbWorkspace workspaceFilter = null;
    if (!Strings.isNullOrEmpty((request.getSourceWorkspaceNamespace()))) {
      workspaceFilter =
          workspaceDao
              .getByNamespace(request.getSourceWorkspaceNamespace())
              .orElseThrow(
                  () ->
                      new NotFoundException(
                          String.format(
                              "workspace namespace '%s' not found",
                              request.getSourceWorkspaceNamespace())));
    }

    Page<DbEgressEvent> page;
    if (userFilter != null && workspaceFilter != null) {
      page =
          egressEventDao.findAllByUserAndWorkspaceOrderByCreationTimeDesc(
              userFilter, workspaceFilter, pageable);
    } else if (workspaceFilter != null) {
      page = egressEventDao.findAllByWorkspaceOrderByCreationTimeDesc(workspaceFilter, pageable);
    } else if (userFilter != null) {
      page = egressEventDao.findAllByUserOrderByCreationTimeDesc(userFilter, pageable);
    } else {
      page = egressEventDao.findAllByOrderByCreationTimeDesc(pageable);
    }

    String nextPageToken = null;
    if (!page.isLast()) {
      nextPageToken =
          PaginationToken.of(pageable.getPageNumber() + 1, toPaginationParams(request)).toBase64();
    }
    return ResponseEntity.ok(
        new ListEgressEventsResponse()
            .events(page.stream().map(egressEventMapper::toApiEvent).collect(Collectors.toList()))
            .nextPageToken(nextPageToken));
  }

  private Object[] toPaginationParams(ListEgressEventsRequest req) {
    return new Object[] {
      req.getSourceUserEmail(), req.getSourceWorkspaceNamespace(), req.getPageSize()
    };
  }

  @AuthorityRequired(Authority.SECURITY_ADMIN)
  @Override
  public ResponseEntity<EgressEvent> updateEgressEvent(
      String id, UpdateEgressEventRequest request) {
    long eventId;
    try {
      eventId = Long.parseLong(id);
    } catch (NumberFormatException e) {
      throw new NotFoundException("egress event not found (id should be numeric)");
    }
    DbEgressEvent dbEgressEvent =
        egressEventDao
            .findById(eventId)
            .orElseThrow(() -> new NotFoundException("egress event not found"));

    if (request.getEgressEvent() == null
        || !updateableStatuses.contains(request.getEgressEvent().getStatus())) {
      throw new BadRequestException(
          "request lacks a valid status, must be one of: "
              + Joiner.on(", ").join(updateableStatuses));
    }

    EgressEventStatus existingStatus = egressEventMapper.toApiStatus(dbEgressEvent.getStatus());
    if (!updateableStatuses.contains(existingStatus)) {
      throw new FailedPreconditionException(
          "current event status is not manually updatable: " + existingStatus);
    }

    DbEgressEventStatus toStatus =
        egressEventMapper.toDbStatus(request.getEgressEvent().getStatus());
    DbEgressEvent updatedEvent = egressEventDao.save(dbEgressEvent.setStatus(toStatus));

    return ResponseEntity.ok(egressEventMapper.toApiEvent(updatedEvent));
  }
}
