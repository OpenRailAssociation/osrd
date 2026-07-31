package fr.sncf.osrd.utils

import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.utils.units.Offset
import java.io.BufferedWriter
import java.io.File

/** Small utility class to log values in a csv */
class CSVLogger(filename: String, private val keys: List<String>) {
    private val writer: BufferedWriter = File(filename).bufferedWriter()

    constructor(filename: String, vararg keys: String) : this(filename, keys.toList())

    init {
        writer.write(keys.joinToString(";") + "\n")
    }

    /** Log the given entries to the CSV. All keys must appear in the object keys. */
    fun log(entries: Map<String, Any>, flush: Boolean = false) {
        assert(entries.keys.all { keys.contains(it) })
        val line = keys.joinToString(separator = ";") { entries.getOrDefault(it, "").toString() }
        writer.write(line + "\n")
        if (flush) writer.flush()
    }

    /** Log the given entries to the CSV. All keys must appear in the object keys. */
    fun log(vararg entries: Pair<String, Any>, flush: Boolean = false) {
        log(mapOf(*entries), flush)
    }

    /** Log the given entries to the CSV, associated with the node lat/lon. */
    fun logGeoNodeData(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        node: STDCMNode,
        vararg entries: Pair<String, Any>,
        flush: Boolean = false,
    ) {
        val p = node.toGeoPoint(rawInfra, blockInfra)
        val data = mutableMapOf(*entries)
        data["lat"] = p.lat
        data["lon"] = p.lon
        log(data, flush)
    }
}

/** Return the geo coordinates of a node. */
fun STDCMNode.toGeoPoint(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    useLocationOnEdge: Boolean = false,
): Point {
    val blockRange = infraExplorer.getCurrentBlockRange()
    val geo = buildTrainPathFromBlock(rawInfra, blockInfra, blockRange.value, listOf()).getGeo()
    val blockLength = blockInfra.getBlockLength(blockRange.value)
    val blockOffset =
        if (useLocationOnEdge) locationOnEdge ?: Offset.zero()
        else blockRange.offsetFromTrainPath(infraExplorer.getSimulatedLength())
    // TODO interpolate at the track-section level, as the geo length is not guaranteed equal to
    //   the topo length for all track-sections
    var p = geo.interpolateNormalized(blockOffset.meters / blockLength.meters)
    if (p.lat.isNaN() || p.lon.isNaN()) p = geo.getPoints().first()
    return p
}
