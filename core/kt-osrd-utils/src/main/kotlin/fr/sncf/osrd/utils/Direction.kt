package fr.sncf.osrd.utils

enum class Direction {
    NORMAL,
    REVERSE;

    val opposite: Direction get() = when (this) {
        NORMAL -> REVERSE
        REVERSE -> NORMAL
    }
}

