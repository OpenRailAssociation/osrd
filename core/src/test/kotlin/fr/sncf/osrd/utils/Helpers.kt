package fr.sncf.osrd.utils

import com.squareup.moshi.JsonAdapter
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.makeSignalingSimulator
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.SignalingSystem
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackLocation
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.sim_infra.impl.getOffsetOfTrackLocationOnChunks
import fr.sncf.osrd.sim_infra.utils.BlockPathElement
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra.utils.toList
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.moshi.MoshiUtils
import fr.sncf.osrd.utils.units.Offset
import java.io.File
import java.io.IOException
import java.net.URISyntaxException
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

object Helpers {
    @JvmStatic
    @get:Throws(IOException::class, OSRDError::class)
    val exampleRollingStocks: List<RJSRollingStock>
        /** Parse all serialized .json rolling stock files */
        get() {
            val jsonMatcher = FileSystems.getDefault().getPathMatcher("glob:**.json")
            val rollingStocksPaths =
                Files.list(getResourcePath("rolling_stocks/"))
                    .filter { path: Path -> path.toFile().isFile() }
                    .filter { path: Path? -> jsonMatcher.matches(path) }
                    .toList()
            val res = ArrayList<RJSRollingStock>()
            for (filePath in rollingStocksPaths) res.add(
                MoshiUtils.deserialize(RJSRollingStock.adapter, filePath)
            )
            res.sortBy { x: RJSRollingStock ->
                x.name
            } // Prevents different behaviors on different OS when running tests
            return res
        }

    @JvmStatic
    @Throws(IOException::class, OSRDError::class)
    fun getExampleRollingStock(fileName: String): RJSRollingStock {
        return MoshiUtils.deserialize(
            RJSRollingStock.adapter,
            getResourcePath("rolling_stocks/$fileName")
        )
    }

    @JvmStatic
    @Throws(IOException::class, URISyntaxException::class)
    fun getExampleInfra(infraPath: String): RJSInfra {
        return deserializeResource(RJSInfra.adapter, "infras/$infraPath")
    }

    @JvmStatic
    @Throws(IOException::class, URISyntaxException::class)
    fun getExampleElectricalProfiles(externalGeneratedInputsPath: String): RJSElectricalProfileSet {
        return deserializeResource(
            RJSElectricalProfileSet.adapter,
            "infras/" + externalGeneratedInputsPath
        )
    }

    @Throws(IOException::class, URISyntaxException::class)
    private fun <T> deserializeResource(adapter: JsonAdapter<T>, resourcePath: String): T {
        val resourceURL =
            {}.javaClass.classLoader.getResource(resourcePath)
                ?: throw IOException("can't find resource $resourcePath")
        return MoshiUtils.deserialize(adapter, Paths.get(resourceURL.toURI()))
    }

    /** Given a resource path find the full path (works cross-platform) */
    @JvmStatic
    fun getResourcePath(resourcePath: String?): Path {
        val url = {}.javaClass.classLoader.getResource(resourcePath)!!
        return try {
            File(url.toURI()).toPath()
        } catch (e: URISyntaxException) {
            throw RuntimeException(e)
        }
    }

    /** Generates a full infra from rjs data */
    @JvmStatic
    fun fullInfraFromRJS(rjs: RJSInfra?): FullInfra {
        val signalingSimulator = makeSignalingSimulator()
        return FullInfra.fromRJSInfra(rjs, signalingSimulator)
    }

    val smallInfra: FullInfra
        /** Loads small infra as a RawSignalingInfra */
        get() =
            try {
                fullInfraFromRJS(getExampleInfra("small_infra/infra.json"))
            } catch (e: IOException) {
                throw RuntimeException(e)
            } catch (e: URISyntaxException) {
                throw RuntimeException(e)
            }

    val tinyInfra: FullInfra
        /** Loads tiny infra as a FullInfra */
        get() =
            try {
                fullInfraFromRJS(getExampleInfra("tiny_infra/infra.json"))
            } catch (e: IOException) {
                throw RuntimeException(e)
            } catch (e: URISyntaxException) {
                throw RuntimeException(e)
            }

    /** returns the blocks on the given routes */
    fun getBlocksOnRoutes(infra: FullInfra, names: List<String?>): List<BlockId> {
        val res = ArrayList<BlockId>()
        val routes = MutableStaticIdxArrayList<Route>()
        for (name in names) routes.add(infra.rawInfra.getRouteFromName(name!!))
        val candidates =
            recoverBlocks(infra.rawInfra, infra.blockInfra, routes, getSignalingSystems(infra))
        assert(candidates.isNotEmpty())
        for (candidate in candidates) res.addAll(candidate.toList().map(BlockPathElement::block))
        return res
    }

    /** Returns the idx list of signaling systems */
    private fun getSignalingSystems(infra: FullInfra): StaticIdxList<SignalingSystem> {
        val res = MutableStaticIdxArrayList<SignalingSystem>()
        for (i in
            0 until infra.signalingSimulator.sigModuleManager.signalingSystems.size.toInt()) res
            .add(StaticIdx(i.toUInt()))
        return res
    }

    /** Converts a route + offset into a block location. */
    @JvmStatic
    fun convertRouteLocation(
        infra: FullInfra,
        routeName: String?,
        offset: Offset<Route>
    ): PathfindingEdgeLocationId<Block> {
        var mutOffset = offset
        val blocks = getBlocksOnRoutes(infra, listOf(routeName))
        for (block in blocks) {
            val blockLength = infra.blockInfra.getBlockLength(block)
            if (mutOffset <= blockLength.cast()) return EdgeLocation(block, mutOffset.cast())
            mutOffset -= blockLength.distance
        }
        throw RuntimeException("Couldn't find route location")
    }

    /** Creates a path from a list of route names and start/end locations */
    @JvmStatic
    @JvmName("chunkPathFromRoutes")
    fun chunkPathFromRoutes(
        infra: RawSignalingInfra,
        routeNames: List<String>,
        start: TrackLocation,
        end: TrackLocation
    ): ChunkPath {
        val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
        for (name in routeNames) {
            val routeId = infra.getRouteFromName(name)
            for (chunk in infra.getChunksOnRoute(routeId)) chunks.add(chunk)
        }
        val startOffset = getOffsetOfTrackLocationOnChunks(infra, start, chunks)
        val endOffset = getOffsetOfTrackLocationOnChunks(infra, end, chunks)
        return buildChunkPath(infra, chunks, startOffset!!, endOffset!!)
    }
}

fun <T> List<StaticIdx<T>>.toIdxList(): StaticIdxList<T> {
    val res = mutableStaticIdxArrayListOf<T>()
    res.addAll(this)
    return res
}
