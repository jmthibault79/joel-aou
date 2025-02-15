package org.pmiops.workbench.actionaudit.targetproperties

enum class BypassTimeTargetProperty
constructor(override val propertyName: String) : SimpleTargetProperty {
    DATA_USER_CODE_OF_CONDUCT("data_use_agreement_bypass_time"),
    RT_COMPLIANCE_TRAINING("compliance_training_time"),
    CT_COMPLIANCE_TRAINING("ct_compliance_training_time"),
    ERA_COMMONS("era_commons_bypass_time"),
    TWO_FACTOR_AUTH("two_factor_auth_bypass_time"),
    RAS_LOGIN_GOV("ras_link_login_gov_bypass_time")
}
