export { createAgentRolesCapability } from '#app/Runtime';
export { getAgentRole, listAgentRoles } from '#entities/agentRole';
export { AGENT_ROLES, AGENT_ROLE_VERSIONS } from '#entities/agentRole';
export { validateAgentHandoff, validateAgentHandoffResult } from '#entities/agentRole';
export { createStrategyRoutingCapability } from '#modules/StrategyRouting';
export { routeStrategy } from '#modules/StrategyRouting';
export { STRATEGY_ROUTING_VERSIONS } from '#entities/executionPlan';
export {
  validateStrategyRoutingDecision,
  validateStrategyRoutingInput,
} from '#entities/executionPlan';
export { createDecompositionCapability } from '#modules/Decomposition';
export { planDecomposition } from '#modules/Decomposition';
export {
  DECOMPOSITION_VERSIONS,
  DEFAULT_DECOMPOSITION_POLICY,
} from '#entities/executionPlan';
export {
  validateDecompositionInput,
  validateDecompositionPolicy,
} from '#entities/executionPlan';
export { createDataStorageCapability, createDataStorageEventConsumer } from '#modules/Telemetry';
export { FileDataStorage } from '#modules/Telemetry';
export { sanitizeRuntimeEventForStorage } from '#modules/Telemetry';
export { createOutcomeIntelligenceCapability } from '#modules/Telemetry';
export { assessOutcome } from '#modules/Telemetry';
export { recordOutcomeAssessment } from '#modules/Telemetry';
export { detectUserCorrection } from '#modules/Telemetry';
export { validateOutcomeAssessment } from '#entities/executionResult';
export { OUTCOME_INTELLIGENCE_VERSIONS } from '#entities/executionResult';
export {
  DATA_STORAGE_LIMITS,
  DATA_STORAGE_VERSIONS,
  DEFAULT_DATA_STORAGE_POLICY,
} from '#modules/Telemetry';
export { createAnalyticsCapability } from '#modules/Analytics';
export { analyzeAmyData } from '#modules/Analytics';
export { analyzeMechanismHealth } from '#modules/Analytics';
export { discoverTaskArchetypes } from '#modules/Analytics';
export { ANALYTICS_LIMITS, ANALYTICS_VERSIONS } from '#modules/Analytics';
export {
  validateAnalyticsEvalRunSample,
  validateAnalyticsInput,
  validateAnalyticsTaskSample,
  validateTaskArchetypeDiscoveryInput,
} from '#modules/Analytics';
export { createEvolutionCapability } from '#modules/Improvement';
export { analyzeCounterfactuals } from '#modules/Improvement';
export { compareShadowStrategy } from '#modules/Improvement';
export { createImprovementProposal, recordImprovementDecision } from '#modules/Improvement';
export { EVOLUTION_LIMITS, EVOLUTION_VERSIONS } from '#modules/Improvement';
export {
  validateCounterfactualAnalysis,
  validateCounterfactualAnalysisInput,
  validateImprovementDecisionInput,
  validateImprovementProposal,
  validateImprovementProposalInput,
  validateShadowStrategyComparison,
  validateShadowStrategyInput,
} from '#modules/Improvement';
export { createEvalSystemCapability } from '#modules/Evaluation';
export { evaluateEvalCase } from '#modules/Evaluation';
export { compareEvalVariants, runEvalCorpus } from '#modules/Evaluation';
export { EVAL_SYSTEM_LIMITS, EVAL_SYSTEM_VERSIONS } from '#modules/Evaluation';
export {
  validateEvalBudget,
  validateEvalCase,
  validateEvalCaseEvaluationInput,
  validateEvalComparisonInput,
  validateEvalComparisonResult,
  validateEvalCorpus,
  validateEvalObservation,
  validateEvalRunInput,
  validateEvalRunResult,
  validateEvalCaseResult,
  validateEvalUsage,
  validateEvalVariant,
} from '#modules/Evaluation';
export { buildDecisionProvenance } from '#modules/Telemetry';
export { createObservabilityCapability } from '#modules/Telemetry';
export { recordObservability } from '#modules/Telemetry';
export { OBSERVABILITY_VERSIONS } from '#modules/Telemetry';
export { validateObservabilityInput } from '#modules/Telemetry';
export { createRecoveryCapability } from '#modules/Recovery';
export { planRecovery } from '#modules/Recovery';
export { RECOVERY_VERSIONS, DEFAULT_RECOVERY_POLICY, RECOVERY_LIMITS } from '#modules/Recovery';
export { validateRecoveryInput, validateRecoveryPlan, validateRecoveryPolicy } from '#modules/Recovery';
export { createCompletionCapability } from '#modules/Completion';
export { runCompletionProtocol } from '#modules/Completion';
export { validateCompletionInput, validateCompletionResult } from '#entities/executionResult';
export { COMPLETION_VERSIONS, DEFAULT_COMPLETION_POLICY } from '#entities/executionResult';
export { createVerificationCapability } from '#modules/Verification';
export { runVerificationPipeline } from '#modules/Verification';
export { VERIFICATION_VERSIONS } from '#entities/verificationResult';
export {
  validateVerificationInput,
  validateVerificationResult,
} from '#entities/verificationResult';
export { runAmyDoctor } from '#app/Runtime';
export { OPERATIONS_VERSIONS } from '#modules/Diagnostics';
export { AmyRuntimeError } from '#entities/runtime';
export { loadRuntimeConfig } from '#app/Runtime';
export { CapabilityRegistry } from '#app/Runtime';
export { discoverPluginInventory } from '#modules/PluginInventory';
export { createPluginInventoryCapability } from '#modules/PluginInventory';
export { createAmyRuntime } from '#app/Runtime';
export { RuntimeEventBus } from '#app/Runtime';
export { AmyRuntime } from '#app/Runtime';
export { MemoryStateStore } from '#app/Runtime';
export { RUNTIME_VERSIONS } from '#entities/runtime';
export { createComputeRoutingCapability } from '#modules/ComputeRouting';
export { routeCompute } from '#modules/ComputeRouting';
export { COMPUTE_PROFILES, COMPUTE_ROUTING_VERSIONS } from '#entities/computeProfile';
export { validateComputeRoutingInput } from '#modules/ComputeRouting';
export { discoverProject } from '#modules/ProjectDiscovery';
export { createProjectIntelligenceCapability } from '#modules/ProjectDiscovery';
export { PROJECT_INTELLIGENCE_VERSIONS } from '#entities/project';
export {
  buildProjectIntelligenceGraph,
  fingerprintProjectIntelligenceKnowledge,
  validateProjectIntelligenceGraph,
} from '#modules/ProjectDiscovery';
export { validateProjectIntelligenceFreshnessSnapshot } from '#modules/ProjectDiscovery';
export { validateSpecWorthinessDecision } from '#entities/project';
export { createContextIntelligenceCapability } from '#modules/ContextResolution';
export type { ICreateContextIntelligenceCapabilityOptions } from '#modules/ContextResolution';
export type { IContextExplorationCache } from '#modules/ContextResolution';
export { CONTEXT_INTELLIGENCE_VERSIONS } from '#entities/context';
export { MemoryContextExplorationCache } from '#modules/ContextResolution';
export { resolveTaskContext } from '#modules/ContextResolution';
export { validateContextResolutionInput } from '#entities/context';
export { createTaskIntelligenceCapability } from '#modules/TaskAnalysis';
export { classifyTask } from '#modules/TaskAnalysis';
export { TASK_INTELLIGENCE_VERSIONS } from '#entities/task';
export {
  validateTaskContract,
  validateTaskIntelligenceAnalysis,
} from '#entities/task';

export type {
  IAmyDoctorReport,
  IDoctorCheck,
  TDoctorCheckStatus,
  TDoctorStatus,
} from '#modules/Diagnostics';
export type { IRunAmyDoctorOptions } from '#modules/Diagnostics';

export type {
  IAnalyticsApi,
  IAnalyticsEvalRunSample,
  IAnalyticsExecutionObservation,
  IAnalyticsFailureClassSummary,
  IAnalyticsFinding,
  IAnalyticsHealthReport,
  IAnalyticsHealthSegmentReport,
  IAnalyticsInput,
  IAnalyticsMechanismHealth,
  IAnalyticsMechanismOutcomeSummary,
  IAnalyticsMechanismRecoverySummary,
  IAnalyticsMechanismSignalSummary,
  IAnalyticsMechanismUsageSummary,
  IAnalyticsMechanismUse,
  IAnalyticsMetric,
  IAnalyticsReport,
  IAnalyticsRoutingChoiceSummary,
  IAnalyticsRoutingCohort,
  IAnalyticsRoutingExecutionSummary,
  IAnalyticsSegmentDefinition,
  IAnalyticsSegmentReport,
  IAnalyticsTaskSample,
  IAnalyticsUsage,
  IAnalyticsWindow,
  ITaskArchetypeAssignment,
  ITaskArchetypeDiscovery,
  ITaskArchetypeDiscoveryInput,
  ITaskArchetypeSummary,
  TAnalyticsConfidence,
  TAnalyticsHealthAssessment,
  TAnalyticsHealthReasonCode,
  TAnalyticsMechanismKind,
  TAnalyticsMechanismSignal,
  TAnalyticsMetricId,
  TAnalyticsMetricUnit,
  TAnalyticsRoutingHealthDimension,
  TTaskArchetype,
  TTaskArchetypeDiscoveryStatus,
  TTaskArchetypeReasonCode,
} from '#modules/Analytics';

export type {
  ICounterfactualAnalysis,
  ICounterfactualAnalysisInput,
  ICounterfactualHypothesis,
  IEvolutionApi,
  IImprovementDecision,
  IImprovementDecisionInput,
  IImprovementProposal,
  IImprovementProposalInput,
  IShadowStrategyComparison,
  IShadowStrategyDifference,
  IShadowStrategyInput,
  TEvolutionCostMetric,
  TEvolutionCounterfactualDimension,
  TEvolutionCounterfactualReasonCode,
  TEvolutionProposalReasonCode,
  TEvolutionRecommendation,
  TEvolutionTarget,
  TEvolutionUserDecision,
  TShadowStrategyDimension,
} from '#modules/Improvement';

export type {
  IComputeAssignment,
  IComputeProfileBinding,
  IComputeRoutingConfig,
  IComputeRoutingDecision,
  IComputeTarget,
  TComputeAssignmentStatus,
  TComputeProfile,
  TComputeReasonCode,
  TComputeTargetKind,
} from '#entities/computeProfile';
export type { IComputeRoutingApi, IComputeRoutingInput, TComputeRoutingMode } from '#modules/ComputeRouting';
export type { ICreateComputeRoutingCapabilityOptions } from '#modules/ComputeRouting';
export type { IRouteComputeOptions } from '#modules/ComputeRouting';

export type {
  IAmyRuntimeErrorProps,
  TAmyRuntimeErrorCode,
} from '#entities/runtime';
export type {
  IAmyRuntimeConfig,
  ICapabilityConfig,
  ILoadedRuntimeConfig,
  ILoadRuntimeConfigProps,
  IRuntimeConfigOverrides,
  TRuntimeConfigSource,
} from '#entities/runtime';
export type {
  IAmyCapability,
  ICapabilityDependencies,
  ICapabilityDependency,
  ICapabilityDescriptor,
  ICapabilityListItem,
} from '#entities/runtime';
export type {
  TCapabilityResolution,
  TCapabilityResolutionStatus,
} from '#entities/runtime';
export type {
  IPluginInventory,
  IPluginInventoryApi,
  IPluginMechanismInventory,
  IPluginMetadataInventory,
  TPluginMechanismKind,
} from '#modules/PluginInventory';
export type {
  IEventDeliveryFailure,
  IEventDeliveryResult,
  IRuntimeEvent,
  IRuntimeEventBus,
  TRuntimeEventConsumer,
  TRuntimeEventType,
} from '#entities/runtime';
export type {
  ISetStateProps,
  IStateAddress,
  IStateRecord,
  IStateStore,
  TJsonPrimitive,
  TJsonValue,
} from '#entities/runtime';
export type {
  ICreateAmyRuntimeProps,
} from '#app/Runtime';
export type { IRuntimeDataContract, TRuntimeDataContractKind } from '#entities/runtime';
export type { TProjectInformation } from '#entities/project';
export type { TContextSelection } from '#entities/context';
export type { TTaskAnalysis } from '#entities/task';
export type { TExecutionPlan, TExecutionStrategy } from '#entities/executionPlan';
export type { TExecutionResult } from '#entities/executionResult';
export type { TQualityResult } from '#entities/verificationResult';
export type {
  IAmyRuntimeProps,
  IAmyRuntimeStatus,
  TRuntimeLifecycle,
} from '#app/Runtime';
export type {
  IArchitectureKnowledge,
  IModuleCandidate,
  IModuleKnowledge,
  IProjectDiscovery,
  IProjectIntelligenceApi,
  IProjectIntelligenceChangedSource,
  IProjectIntelligenceFreshnessAssessment,
  IProjectIntelligenceFreshnessOwnerAssessment,
  IProjectIntelligenceFreshnessOwnerSnapshot,
  IProjectIntelligenceFreshnessSnapshot,
  IProjectIntelligenceGraph,
  IProjectIntelligenceGraphEdge,
  IProjectIntelligenceGraphNode,
  IProjectIntelligenceIndex,
  IProjectIntelligenceImpactAnalysis,
  IProjectIntelligenceKnowledge,
  IProjectIntelligenceModuleIndex,
  IProjectIntelligenceModuleSummary,
  IProjectIntelligenceSourceFingerprint,
  IProjectKnowledge,
  ISpecWorthinessDecision,
  TAgentsRouterSyncResult,
  TModuleCandidateSignal,
  TProjectIntelligenceChangeKind,
  TProjectIntelligenceChangeRisk,
  TProjectIntelligenceFreshnessReason,
  TProjectIntelligenceFreshnessState,
  TProjectIntelligenceGraphNodeKind,
  TProjectIntelligenceGraphRelation,
  TProjectIntelligenceGraphState,
  TProjectIntelligenceOwner,
  TProjectIntelligenceRiskReason,
  TProjectIntelligenceSourceKind,
  TProjectIntelligenceSourceRole,
  TSpecWorthinessConfidence,
  TSpecWorthinessReason,
} from '#entities/project';

export type {
  IContextBudgetLimits,
  IContextBudgetSummary,
  IContextBudgetUsage,
  IContextIntelligenceApi,
  IContextModuleSelection,
  IContextPacket,
  IContextResolution,
  IContextResolutionInput,
  IContextSelectionData,
  IContextSpecSelection,
  TContextBudgetProfile,
  TContextConfidence,
  TContextEvidenceGap,
  TContextExploration,
  TContextGraphState,
  TContextIntelligenceSelection,
  TContextModuleFreshness,
  TContextModuleRelevance,
  TContextReasonCode,
} from '#entities/context';

export type {
  ITaskAffectedScope,
  ITaskAnalysisData,
  ITaskClassification,
  ITaskClassificationDimensions,
  ITaskClassificationInput,
  ITaskContract,
  ITaskIntelligenceApi,
  ITaskProjectEvidence,
  ITaskProjectModuleEvidence,
  TTaskClassificationEvidenceGap,
  TTaskClassificationMode,
  TTaskClassificationReasonCode,
  TTaskConfidence,
  TTaskLevel,
  TTaskProjectFreshnessState,
  TTaskProjectGraphState,
  TTaskProjectRisk,
  TTaskProjectRiskReason,
  TTaskIntelligenceAnalysis,
  TTaskScope,
} from '#entities/task';

export type {
  IStrategyRoutingApi,
  IStrategyRoutingData,
  IStrategyRoutingInput,
  TStrategyEscalation,
  TStrategyExecution,
  TStrategyExploration,
  TStrategyPlanning,
  TStrategyReasonCode,
  TStrategyReview,
  TStrategyRoutingDecision,
  TStrategyVerification,
} from '#entities/executionPlan';

export type {
  IAgentChildDelegationPolicy,
  IAgentHandoff,
  IAgentHandoffAgentSource,
  IAgentHandoffEvidence,
  IAgentHandoffInput,
  IAgentHandoffOrchestratorSource,
  IAgentHandoffOutput,
  IAgentHandoffResult,
  IAgentHandoffScope,
  IAgentRoleDescriptor,
  IAgentRolesApi,
  TAgentEvidenceKind,
  TAgentHandoffSource,
  TAgentHandoffStatus,
  TAgentReadPolicy,
  TAgentRole,
  TAgentRoleInputKind,
  TAgentRoleOutputKind,
  TAgentToolPolicy,
  TAgentWritePolicy,
} from '#entities/agentRole';

export type {
  IDecompositionApi,
  IDecompositionDag,
  IDecompositionDagNode,
  IDecompositionInput,
  IDecompositionLifecyclePolicy,
  IDecompositionLimits,
  IDecompositionNodeProposal,
  IDecompositionPlanData,
  IDecompositionPolicyConfig,
  IDecompositionProposal,
  IParallelismDecision,
  IStrategyDecompositionSource,
  IWorkerDecompositionSource,
  TDecompositionDecision,
  TDecompositionNodeRole,
  TDecompositionPlan,
  TDecompositionReasonCode,
  TDecompositionSource,
  TDecompositionTrigger,
  TDagCancellationPolicy,
  TDagFailurePolicy,
  TDagNodeReadiness,
  TDagReplanningPolicy,
  TParallelismMode,
  TParallelismReasonCode,
} from '#entities/executionPlan';
export type {
  IOutcomeAssessment,
  IOutcomeAttempts,
  IOutcomeFailure,
  IOutcomeInput,
  IOutcomeIntelligenceApi,
  IOutcomePostTaskSignal,
  IOutcomeRecordReceipt,
  IUserCorrectionDetection,
  IUserCorrectionDetectionInput,
  TOutcomeConfidence,
  TOutcomeFailureClass,
  TOutcomeFailureSource,
  TOutcomeReasonCode,
  TOutcomeRecordStatus,
  TOutcomeStatus,
  TPostTaskSignalImpact,
  TPostTaskSignalKind,
  TUserCorrectionClassification,
  TUserCorrectionReasonCode,
} from '#entities/executionResult';
export type { IRecordOutcomeAssessmentOptions } from '#modules/Telemetry';

export type {
  IObservabilityApi,
  IObservabilityDecisionInput,
  IObservabilityDecisionRecord,
  IObservabilityPolicyRef,
  IObservabilityReceipt,
  IObservabilitySubject,
  IObservabilityTelemetryInput,
  IObservabilityTelemetryRecord,
  TObservabilityConfidence,
  TObservabilityDeliveryStatus,
  TObservabilityDecisionKind,
  TObservabilityInput,
  TObservabilityRecord,
  TObservabilitySubjectKind,
  TObservabilityTelemetryEvent,
} from '#modules/Telemetry';


export type {
  IDataPrivacyPolicy,
  IDataStorageApi,
  IDataStorageCaptureReceipt,
  IDataStorageCleanupReceipt,
  IDataStorageExport,
  IDataStorageExportOptions,
  IDataStorageRawRecord,
  IDataStorageStatus,
  TDataStorageCaptureStatus,
  TDataStorageCleanupStatus,
  TDataStorageWriteState,
  TRawContentStoragePolicy,
  TSqliteStorageMode,
} from '#modules/Telemetry';
export type { ICreateDataStorageCapabilityOptions } from '#modules/Telemetry';
export type { IFileDataStorageOptions } from '#modules/Telemetry';

export type { TDecisionProvenanceSource } from '#modules/Telemetry';
export type { ICreateObservabilityCapabilityOptions } from '#modules/Telemetry';
export type { IRecordObservabilityOptions } from '#modules/Telemetry';

export type {
  IRecoveryApi,
  IRecoveryAttemptState,
  IRecoveryBranch,
  IRecoveryDiagnosis,
  IRecoveryFact,
  IRecoveryFailureSignal,
  IRecoveryInput,
  IRecoveryPlanData,
  IRecoveryPolicyConfig,
  TRecoveryAction,
  TRecoveryBranchKind,
  TRecoveryFailureClass,
  TRecoveryPlan,
  TRecoveryReasonCode,
} from '#modules/Recovery';
export type { ICreateRecoveryCapabilityOptions } from '#modules/Recovery';
export type { IPlanRecoveryOptions } from '#modules/Recovery';

export type {
  ICompletionApi,
  ICompletionEvidence,
  ICompletionExecutionEvidence,
  ICompletionGuardInput,
  ICompletionGuardResult,
  ICompletionInput,
  ICompletionIntegrationEvidence,
  ICompletionResultData,
  ICompletionVerificationEvidence,
  TCompletionConfidence,
  TCompletionGuardDecision,
  TCompletionIntegrationStatus,
  TCompletionReasonCode,
  TCompletionResult,
  TCompletionStatus,
  TCompletionWorkStatus,
} from '#entities/executionResult';

export type {
  IMechanicalVerificationCheck,
  IMechanicalVerificationResult,
  IReviewFinding,
  IReviewerReport,
  IReviewVerificationResult,
  ISemanticVerificationResult,
  IVerificationApi,
  IVerificationArtifactRefs,
  IVerificationInput,
  IVerificationResultData,
  IVerifierCriterionResult,
  IVerifierReport,
  TMechanicalCheckKind,
  TMechanicalCheckStatus,
  TReviewFindingSeverity,
  TVerificationCriterionKind,
  TVerificationCriterionStatus,
  TVerificationReasonCode,
  TVerificationResult,
  TVerificationStageStatus,
  TVerificationStatus,
} from '#entities/verificationResult';

export type {
  ICreateDecompositionCapabilityOptions,
} from '#modules/Decomposition';
export type {
  IPlanDecompositionOptions,
} from '#modules/Decomposition';

export type {
  IEvalBudget,
  IEvalCase,
  IEvalCaseEvaluationInput,
  IEvalCaseResult,
  IEvalCheckResult,
  IEvalComparisonInput,
  IEvalComparisonResult,
  IEvalCorpus,
  IEvalExecutorInput,
  IEvalObservation,
  IEvalRunInput,
  IEvalRunResult,
  IEvalScoringPolicy,
  IEvalSystemApi,
  IEvalUsage,
  IEvalVariant,
  TEvalCaseStatus,
  TEvalCheckStatus,
  TEvalComparisonStatus,
  TEvalComparisonWinner,
  TEvalCorpusKind,
  TEvalExecutor,
  TEvalExpectation,
  TEvalExpectationKind,
  TEvalRunStatus,
} from '#modules/Evaluation';

