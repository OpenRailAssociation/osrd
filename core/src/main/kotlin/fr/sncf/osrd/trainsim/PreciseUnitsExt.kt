package fr.sncf.osrd.trainsim

import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Speed

fun Duration.toPrecise(): PreciseDuration = PreciseDuration(microseconds = milliseconds * 1000)

fun Speed.toPrecise(): PreciseSpeed =
    PreciseSpeed(micrometersPerSecond = millimetersPerSecond.toLong() * 1000)
