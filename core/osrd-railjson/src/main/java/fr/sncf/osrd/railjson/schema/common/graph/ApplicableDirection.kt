package fr.sncf.osrd.railjson.schema.common.graph

enum class ApplicableDirection {
    START_TO_STOP,
    STOP_TO_START,
    BOTH;

    /**
     * Returns the opposite applicable directions
     *
     * @return The opposite applicable directions
     */
    fun opposite(): ApplicableDirection {
        return when (this) {
            START_TO_STOP -> STOP_TO_START
            STOP_TO_START -> START_TO_STOP
            BOTH -> BOTH
        }
    }

    fun appliesToNormal(): Boolean {
        return this != STOP_TO_START
    }

    fun appliesToReverse(): Boolean {
        return this != START_TO_STOP
    }
}
