package org.pmiops.workbench.audit

data class ActionAuditEvent(
    val timestamp: Long,
    val agentType: AgentType,
    val agentId: Long,
    val agentEmailMaybe: String?,
    val actionId: String,
    val actionType: ActionType,
    val targetType: TargetType,
    val targetPropertyMaybe: String? = null,
    val targetIdMaybe: Long? = null,
    val previousValueMaybe: String? = null,
    val newValueMaybe: String? = null
)
