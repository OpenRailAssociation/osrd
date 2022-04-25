package fr.sncf.osrd.dyn_infra.api

enum class DetectionSectionState(val reserved: Boolean, val occupied: Boolean) {
    UNRESERVED_FREE(reserved = false, occupied = false),
    RESERVED_FREE(reserved = true, occupied = false),
    UNRESERVED_OCCUPIED(reserved = false, occupied = true),
    RESERVED_OCCUPIED(reserved = true, occupied = true);

    companion object {
        @JvmStatic fun get(reserved: Boolean, occupied: Boolean): DetectionSectionState {
            return if (occupied) {
                if (reserved) RESERVED_OCCUPIED else UNRESERVED_OCCUPIED
            } else {
                if (reserved) RESERVED_FREE else UNRESERVED_FREE
            }
        }
    }
}