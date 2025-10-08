package fr.sncf.osrd.utils

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.makeSignalingSimulator
import fr.sncf.osrd.api.standalone_sim.PhysicsConsistModel
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.SignalingSystem
import fr.sncf.osrd.sim_infra.api.SignalingSystemId
import fr.sncf.osrd.sim_infra.utils.recoverBlocks
import fr.sncf.osrd.sim_infra.utils.toBlockList
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.moshi.MoshiUtils
import fr.sncf.osrd.utils.units.Offset
import java.io.File
import java.io.IOException
import java.net.URISyntaxException
import java.nio.file.Path
import java.nio.file.Paths

object Helpers {

    @Throws(IOException::class, OSRDError::class)
    fun getExampleRollingStock(fileName: String): PhysicsConsistModel {
        val adapter: JsonAdapter<PhysicsConsistModel> =
            Moshi.Builder()
                .add(RJSRollingResistance.adapter)
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(PhysicsConsistModel::class.java)
        return MoshiUtils.deserialize(adapter, getResourcePath("rolling_stocks/$fileName"))
    }

    @Throws(IOException::class, URISyntaxException::class)
    fun getExampleInfra(infraPath: String): RJSInfra {
        return deserializeResource(RJSInfra.adapter, "infras/$infraPath")
    }

    @Throws(IOException::class, URISyntaxException::class)
    fun getExampleElectricalProfiles(externalGeneratedInputsPath: String): RJSElectricalProfileSet {
        return deserializeResource(
            RJSElectricalProfileSet.adapter,
            "infras/$externalGeneratedInputsPath",
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
        for (candidate in candidates) {
            res.addAll(candidate.toBlockList())
        }
        return res
    }

    /** Returns the idx list of signaling systems */
    private fun getSignalingSystems(infra: FullInfra): List<SignalingSystemId> {
        val res = MutableStaticIdxArrayList<SignalingSystem>()
        for (i in
            0 until infra.signalingSimulator.sigModuleManager.signalingSystems.size.toInt()) res
            .add(StaticIdx(i.toUInt()))
        return res
    }

    data class LocationPair(
        val blockLocations: Set<EdgeLocation<BlockId, Block>>,
        val trackLocations: Set<TrackLocation>,
    )

    /** Converts a route + offset into a block location. */
    fun convertRouteLocationToBlockLocation(
        infra: FullInfra,
        routeName: String,
        offset: Offset<Route>,
    ): EdgeLocation<BlockId, Block> {
        var mutOffset = offset
        val blocks = getBlocksOnRoutes(infra, listOf(routeName))
        for (block in blocks) {
            val blockLength = infra.blockInfra.getBlockLength(block)
            if (mutOffset <= blockLength.cast()) return EdgeLocation(block, mutOffset.cast())
            mutOffset -= blockLength.distance
        }
        throw RuntimeException("Couldn't find route location")
    }
}
