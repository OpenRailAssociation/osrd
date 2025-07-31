package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.utils.units.Offset

interface TrainPath {
    fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath
}

fun concat(vararg paths: TrainPath): TrainPath {
    TODO()
}
