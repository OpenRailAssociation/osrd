package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.exceptions.OSRDError
import java.io.Serial

class SignalizationError(message: String?, errorCause: ErrorCause?) : OSRDError(message, errorCause) {
    companion object {
        @Serial
        const val serialVersionUID = -4664988804881395290L
        const val osrdErrorType = "signalization"
    }
}