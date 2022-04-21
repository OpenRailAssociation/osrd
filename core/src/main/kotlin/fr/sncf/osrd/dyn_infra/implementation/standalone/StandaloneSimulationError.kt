package fr.sncf.osrd.dyn_infra.implementation.standalone

import fr.sncf.osrd.exceptions.OSRDError
import java.io.Serial

open class StandaloneSimulationError protected constructor(message: String) : OSRDError(message, ErrorCause.INTERNAL) {
    companion object {
        @Serial
        const val serialVersionUID = -2966725866296617520L
        const val osrdErrorType = "standalone_simulation"
    }
}