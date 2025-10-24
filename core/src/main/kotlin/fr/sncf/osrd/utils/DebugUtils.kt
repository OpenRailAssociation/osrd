package fr.sncf.osrd.utils

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
    fun log(entries: Map<String, Any>) {
        assert(entries.keys.all { keys.contains(it) })
        val line = keys.joinToString(separator = ";") { entries.getOrDefault(it, "").toString() }
        writer.write(line + "\n")
    }

    /** Log the given entries to the CSV. All keys must appear in the object keys. */
    fun log(vararg entries: Pair<String, Any>) {
        log(mapOf(*entries))
    }

    /** Log the given entries to the CSV, associated with the node lat/lon. */
    fun logGeoNodeData(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        node: STDCMNode,
        vararg entries: Pair<String, Any>,
    ) {
        val block = node.infraExplorer.getCurrentBlock()
        val geo = buildTrainPathFromBlock(rawInfra, blockInfra, block).getGeo()
        val blockLength = blockInfra.getBlockLength(block)
        val offset = node.locationOnEdge ?: Offset.zero()
        var p = geo.interpolateNormalized(offset.meters / blockLength.meters)
        if (p.lat.isNaN() || p.lon.isNaN()) p = geo.getPoints().first()

        val data = mutableMapOf(*entries)
        data["lat"] = p.lat
        data["lon"] = p.lon
        log(data)
    }
}
