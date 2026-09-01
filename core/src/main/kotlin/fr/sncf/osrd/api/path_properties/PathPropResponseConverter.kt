package fr.sncf.osrd.api.path_properties

import com.google.common.collect.Range
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.from
import fr.sncf.osrd.utils.toRangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

fun makePathPropResponse(pathProperties: TrainPath, rawInfra: RawSignalingInfra): PathPropResponse {
    return PathPropResponse(
        makeSlopes(pathProperties),
        makeCurves(pathProperties),
        makeElectrifications(pathProperties),
        makeGeographic(pathProperties),
        makeOperationalPoints(pathProperties, rawInfra),
        makeZones(pathProperties, rawInfra),
        makeGeometricProjection(pathProperties, rawInfra),
    )
}

private fun makeSlopes(pathProperties: TrainPath): RangeValues<Double> {
    return makeRangeValues(pathProperties.getSlopes())
}

private fun makeCurves(pathProperties: TrainPath): RangeValues<Double> {
    return makeRangeValues(pathProperties.getCurves())
}

private fun makeElectrifications(pathProperties: TrainPath): RangeValues<Electrification> {
    val electrifications = makeElectrificationMap(pathProperties.getElectrification())
    val neutralSections = makeElectrificationMap(pathProperties.getNeutralSections())
    val mergedMap = DistanceRangeMapImpl.toRangeMap(electrifications)
    for (neutralSection in neutralSections) {
        // Neutral section has priority over any electrification on an overlapping range
        mergedMap.merge(
            Range.closed(neutralSection.lower, neutralSection.upper),
            neutralSection.value,
        ) { _, neutralSectionValue ->
            neutralSectionValue
        }
    }
    return makeRangeValues(DistanceRangeMapImpl.from(mergedMap))
}

private fun makeGeographic(path: TrainPath): RJSLineString {
    val lineString = path.getGeo()
    val coordinates = ArrayList<List<Double>>()
    for (p in lineString.getPoints()) coordinates.add(listOf(p.lon, p.lat))
    return RJSLineString("LineString", coordinates)
}

private fun makeOperationalPoints(
    path: TrainPath,
    rawInfra: RawSignalingInfra,
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
        val localTrackName =
            opPartProps["local_track_name"]
                ?: throw IllegalArgumentException("Missing required 'local_track_name'")
        val opPartResult =
            OperationalPointPartResponse(
                trackSectionName,
                opPartTrackSectionOffset.meters,
                localTrackName,
                if (opPartProps["kp"] == null) null
                else
                    OperationalPointPartExtension(
                        OperationalPointPartSncfExtension(opPartProps["kp"]!!)
                    ),
            )
        val weight = if (opPartProps["weight"] == null) null else opPartProps["weight"]!!.toLong()
        val opResult =
            OperationalPointResponse(
                operationalPointId,
                opPartResult,
                offset,
                weight,
                opPartProps["name"]!!,
                opPartProps["uic"]?.toLong(),
                opPartProps["plc"],
                opPartProps["countryCode"]!!,
                opPartProps["mainCode"]!!,
                opPartProps["secondaryCode"],
                opPartProps["isPassengerStation"] == "true",
                opPartProps["secondaryName"],
            )
        res.add(opResult)
    }
    return res
}

private fun makeZones(path: TrainPath, rawInfra: RawSignalingInfra): RangeValues<String> {
    val zoneIds = makeRangeValues(path.getZones())
    return RangeValues(zoneIds.internalBoundaries, zoneIds.values.map { rawInfra.getZoneName(it) })
}

private fun <T> makeRangeValues(distanceRangeMap: DistanceRangeMap<T>): RangeValues<T> {
    val boundaries = mutableListOf<Offset<PhysicsPath>>()
    val values = mutableListOf<T>()
    distanceRangeMap.forEach { _, upper, value ->
        boundaries.add(Offset(upper))
        values.add(value)
    }
    boundaries.removeLast()
    return RangeValues(boundaries, values)
}

private fun makeElectrificationMap(
    distanceRangeMap: DistanceRangeMap<out Any>
): DistanceRangeMap<Electrification> {
    val res = DistanceRangeMapImpl<Electrification>()
    distanceRangeMap.forEach { lower, upper, value ->
        when (value) {
            // Is electrified
            is Set<*> -> {
                res.put(
                    lower,
                    upper,
                    if (value.isEmpty()) NonElectrified() else Electrified(value.first() as String),
                )
            }
            // Is neutral
            is NeutralSection -> {
                res.put(lower, upper, Neutral(value.lowerPantograph))
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

private fun makeGeometricProjection(
    pathProperties: TrainPath,
    rawInfra: RawSignalingInfra,
): GeometricProjection {
    val trackRanges = pathProperties.getTrackRanges()

    fun getTrackSectionGeometricLength(trackSection: TrackSectionId): Length<RJSLineString> {
        val chunks = rawInfra.getTrackSectionChunks(trackSection)
        return chunks
            .map {
                Length<RJSLineString>(Distance.fromMeters(rawInfra.getTrackChunkGeom(it).length))
            }
            .reduce { acc, length -> acc + length.distance }
    }

    val geomOffsets = mutableListOf<Offset<RJSLineString>>(Offset.zero())
    val topoOffsets = mutableListOf<Offset<PhysicsPath>>(Offset.zero())

    trackRanges.forEachIndexed { i, range ->
        val rangeTopoLength = range.length
        val trackSectionTopoLength = range.objectLength
        val trackSectionGeomLength = getTrackSectionGeometricLength(range.value.value)
        topoOffsets.addLast(topoOffsets.last() + rangeTopoLength)
        val proportion = rangeTopoLength / trackSectionTopoLength.distance
        val rangeGeomLength = trackSectionGeomLength.distance * proportion
        geomOffsets.addLast(geomOffsets.last() + rangeGeomLength)
    }

    return GeometricProjection(topoOffsets, geomOffsets)
}
