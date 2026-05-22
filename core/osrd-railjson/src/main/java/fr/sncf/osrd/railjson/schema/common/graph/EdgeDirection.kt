package fr.sncf.osrd.railjson.schema.common.graph

/** Encodes a direction along an edge. */
enum class EdgeDirection(val id: Int) {
    START_TO_STOP(0),
    STOP_TO_START(1);

    /**
     * Gets the opposite of this direction
     *
     * @return this opposite of this direction
     */
    fun opposite(): EdgeDirection {
        if (this == START_TO_STOP) return STOP_TO_START
        return START_TO_STOP
    }
}
