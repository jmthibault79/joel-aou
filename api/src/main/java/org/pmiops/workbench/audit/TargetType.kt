package org.pmiops.workbench.audit

// do not rename these, as they are serialized as text
enum class TargetType {
    USER,
    WORKBENCH,
    PROFILE,
    ACCOUNT,
    NOTEBOOK,
    NOTEBOOK_SERVER,
    DATASET,
    CONCEPT_SET,
    COHORT,
    CREDIT,
    WORKSPACE
}
