package fr.sncf.osrd.api.api_v2.path_properties

import com.google.common.collect.Range
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.api.pathfinding.toRJSLineString
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.units.Offset

fun makePathPropResponse(
    pathProperties: PathProperties,
    rawInfra: RawSignalingInfra
): PathPropResponse {
    return PathPropResponse(
        makeSlopes(pathProperties),
        makeCurves(pathProperties),
        makeElectrifications(pathProperties),
        makeGeographic(pathProperties),
        makeOperationalPoints(pathProperties, rawInfra),
        makeZones(pathProperties, rawInfra)
    )
}

private fun makeSlopes(pathProperties: PathProperties): RangeValues<Double> {
    return makeRangeValues(pathProperties.getSlopes())
}

private fun makeCurves(pathProperties: PathProperties): RangeValues<Double> {
    return makeRangeValues(pathProperties.getCurves())
}

private fun makeElectrifications(pathProperties: PathProperties): RangeValues<Electrification> {
    val electrifications = makeElectrificationMap(pathProperties.getElectrification())
    val neutralSections = makeElectrificationMap(pathProperties.getNeutralSections())
    val mergedMap = DistanceRangeMapImpl.toRangeMap(electrifications)
    for (neutralSection in neutralSections) {
        // Neutral section has priority over any electrification on an overlapping range
        mergedMap.merge(
            Range.closed(neutralSection.lower, neutralSection.upper),
            neutralSection.value
        ) { _, neutralSectionValue ->
            neutralSectionValue
        }
    }
    return makeRangeValues(DistanceRangeMapImpl.from(mergedMap))
}

private fun makeGeographic(path: PathProperties): RJSLineString {
    return toRJSLineString(path.getGeo())
}

private fun makeOperationalPoints(
    path: PathProperties,
    rawInfra: RawSignalingInfra
): List<OperationalPointResponse> {
    val res = mutableListOf<OperationalPointResponse>()
    for ((opPartId, offset) in path.getOperationalPointParts()) {
        val operationalPointId = rawInfra.getOperationalPointPartOpId(opPartId)
        val trackSection =
            rawInfra.getTrackFromChunk(rawInfra.getOperationalPointPartChunk(opPartId))
        val trackSectionName = rawInfra.getTrackSectionName(trackSection)
        val chunkOffset = rawInfra.getOperationalPointPartChunkOffset(opPartId)
        val opPartTrackSectionOffset =
            rawInfra.getTrackChunkOffset(rawInfra.getOperationalPointPartChunk(opPartId)).distance +
                chunkOffset.distance
        val opPartProps = rawInfra.getOperationalPointPartProps(opPartId)
        val opPartResult =
            OperationalPointPartResponse(
                trackSectionName,
                opPartTrackSectionOffset.meters,
                if (opPartProps["kp"] == null) null
                else
                    OperationalPointPartExtension(
                        OperationalPointPartSncfExtension(opPartProps["kp"]!!)
                    )
            )
        // If ci is null, then all its other values and the entire op sncf extension are null
        val opSncfExtension =
            if (opPartProps["ci"] == null) null
            else
                OperationalPointSncfExtension(
                    opPartProps["ci"]!!.toLong(),
                    opPartProps["ch"]!!,
                    opPartProps["chShortLabel"]!!,
                    opPartProps["chLongLabel"]!!,
                    opPartProps["trigram"]!!
                )
        // if name is null, uic and the op id extension are null
        val opIdExtension =
            if (opPartProps["identifier"] == null) null
            else
                OperationalPointIdentifierExtension(
                    opPartProps["identifier"]!!,
                    opPartProps["uic"]!!.toLong()
                )
        val opExtensions =
            if (opSncfExtension == null && opIdExtension == null) null
            else OperationalPointExtensions(opSncfExtension, opIdExtension)
        val opResult =
            OperationalPointResponse(operationalPointId, opPartResult, opExtensions, offset)
        res.add(opResult)
    }
    return res
}

private fun makeZones(path: PathProperties, rawInfra: RawSignalingInfra): RangeValues<String> {
    val zoneIds = makeRangeValues(path.getZones())
    return RangeValues(zoneIds.internalBoundaries, zoneIds.values.map { rawInfra.getZoneName(it) })
}

private fun <T> makeRangeValues(distanceRangeMap: DistanceRangeMap<T>): RangeValues<T> {
    return makeRangeValues(distanceRangeMap.asList())
}

private fun <T> makeRangeValues(entries: List<DistanceRangeMap.RangeMapEntry<T>>): RangeValues<T> {
    val boundaries = mutableListOf<Offset<TravelledPath>>()
    val values = mutableListOf<T>()
    for (entry in entries) {
        boundaries.add(Offset(entry.upper))
        values.add(entry.value)
    }
    boundaries.removeLast()
    return RangeValues(boundaries, values)
}

private fun makeElectrificationMap(
    distanceRangeMap: DistanceRangeMap<out Any>
): DistanceRangeMap<Electrification> {
    val res = DistanceRangeMapImpl<Electrification>()
    for (entry in distanceRangeMap) {
        when (entry.value) {
            // Is electrified
            is String -> {
                res.put(
                    entry.lower,
                    entry.upper,
                    if (entry.value == "") NonElectrified() else Electrified(entry.value as String)
                )
            }
            // Is neutral
            is NeutralSection -> {
                res.put(
                    entry.lower,
                    entry.upper,
                    Neutral((entry.value as NeutralSection).lowerPantograph)
                )
            }
            else -> {
                throw IllegalArgumentException(
                    "Input should be a distanceRangeMap of String or Boolean"
                )
            }
        }
    }
    return res
}
