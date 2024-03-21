package fr.sncf.osrd.signaling

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.OffsetList
import fr.sncf.osrd.utils.units.Speed

enum class ProtectionStatus {
    /**
     * The signal does not directly protect zones. Only used for distant signals in some signaling
     * systems
     */
    NO_PROTECTED_ZONES,

    /** The zones protected by the signal are ready to be used */
    CLEAR,

    /** The zones protected by the signal are occupied by a train, but otherwise clear to use */
    OCCUPIED,

    /** The zones protected by the signal are incompatible, and could also be occupied. */
    INCOMPATIBLE,
}

interface MovementAuthorityView {
    /** Combined status of the zones protected by the current signal */
    val protectionStatus: ProtectionStatus
    val nextSignalState: SigState
    val nextSignalSettings: SigSettings
    val hasNextSignal: Boolean
}

interface DirectSpeedLimit {
    /** Distance between the signal and the speed limit */
    val distance: Distance
    val speed: Speed
}

interface IndirectSpeedLimit {
    val distanceToNextSignal: Distance
    val nextSignalState: SigState
    val nextSignalSettings: SigSettings
}

interface SpeedLimitView {
    /** A list of speed limits directly in front of the signal */
    val directSpeedLimits: List<DirectSpeedLimit>
    /** A list of speed limits which need to be announced in a signal chain */
    val indirectSpeedLimits: List<IndirectSpeedLimit>
}

data class SigBlock(
    val startsAtBufferStop: Boolean,
    val stopsAtBufferStop: Boolean,
    val signalTypes: List<String>,
    val signalSettings: List<SigSettings>,
    val signalPositions: OffsetList<Block>,
    val length: Distance,
)

interface SignalDiagReporter {
    fun report(errorType: String)
}

interface SignalDriver {
    val name: String
    val inputSignalingSystem: String
    val outputSignalingSystem: String

    fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState

    /** block is the partial block in front of the signal, as no signal can see backward */
    fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock)
}

interface BlockDiagReporter {
    fun reportBlock(errorType: String)

    fun reportSignal(sigIndex: Int, errorType: String)
}


interface SignalingTrainState {
    val speed: Speed
}

interface SignalingSystemDriver {
    val parametersSchema: SigParametersSchema
    val id: String
    val stateSchema: SigStateSchema
    val settingsSchema: SigSettingsSchema
    val isBlockDelimiterExpr: String

    fun checkBlock(reporter: BlockDiagReporter, block: SigBlock)
    fun isConstraining(signalState: SigData<SignalStateMarker>, trainState: SignalingTrainState): Boolean
}
