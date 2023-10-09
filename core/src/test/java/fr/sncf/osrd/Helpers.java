package fr.sncf.osrd;

import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;
import static fr.sncf.osrd.sim_infra.impl.PathPropertiesImplKt.buildChunkPath;
import static fr.sncf.osrd.sim_infra.utils.BlockRecoveryKt.recoverBlocks;
import static fr.sncf.osrd.sim_infra.utils.BlockRecoveryKt.toList;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import com.squareup.moshi.JsonAdapter;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.schema.external_generated_inputs.RJSElectricalProfileSet;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.sim_infra.api.*;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
import fr.sncf.osrd.sim_infra.impl.PathPropertiesImplKt;
import fr.sncf.osrd.sim_infra.utils.BlockPathElement;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList;
import fr.sncf.osrd.utils.indexing.StaticIdxList;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;


public class Helpers {
    /** Parse all serialized .json rolling stock files */
    public static List<RJSRollingStock> getExampleRollingStocks() throws IOException, OSRDError {
        var jsonMatcher = FileSystems.getDefault().getPathMatcher("glob:**.json");
        var rollingStocksPaths = Files.list(getResourcePath("rolling_stocks/"))
                .filter((path) -> path.toFile().isFile())
                .filter(jsonMatcher::matches)
                .toList();

        var res = new ArrayList<RJSRollingStock>();
        for (var filePath : rollingStocksPaths)
            res.add(MoshiUtils.deserialize(RJSRollingStock.adapter, filePath));
        res.sort(Comparator.comparing(x -> x.name)); // Prevents different behaviors on different OS when running tests
        return res;
    }

    public static RJSRollingStock getExampleRollingStock(String fileName) throws IOException, OSRDError {
        return MoshiUtils.deserialize(RJSRollingStock.adapter, getResourcePath("rolling_stocks/" + fileName));
    }

    public static RJSInfra getExampleInfra(String infraPath) throws IOException, URISyntaxException {
        return deserializeResource(RJSInfra.adapter, infraPath);
    }

    public static RJSElectricalProfileSet getExampleElectricalProfiles(
            String externalGeneratedInputsPath
    ) throws IOException, URISyntaxException {
        return deserializeResource(RJSElectricalProfileSet.adapter, externalGeneratedInputsPath);
    }

    private static <T> T deserializeResource(
            JsonAdapter<T> adapter,
            String resourcePath
    ) throws IOException, URISyntaxException {
        ClassLoader loader = Helpers.class.getClassLoader();
        var resourceURL = loader.getResource(resourcePath);
        if (resourceURL == null)
            throw new IOException("can't find resource " + resourcePath);
        return MoshiUtils.deserialize(adapter, Paths.get(resourceURL.toURI()));
    }

    /** Given a resource path find the full path (works cross platform) */
    public static Path getResourcePath(String resourcePath) {
        ClassLoader classLoader = Helpers.class.getClassLoader();
        var url = classLoader.getResource(resourcePath);
        assert url != null;
        try {
            return new File(url.toURI()).toPath();
        } catch (URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    /** Generates a signaling infra from rjs data */
    public static SignalingInfra infraFromRJS(RJSInfra rjs) {
        var wr = new DiagnosticRecorderImpl(true);
        return SignalingInfraBuilder.fromRJSInfra(rjs, Set.of(new BAL3(wr)), wr);
    }

    /** Generates a full infra from rjs data */
    public static FullInfra fullInfraFromRJS(RJSInfra rjs) {
        var diagnosticRecorder = new DiagnosticRecorderImpl(true);
        var signalingSimulator = makeSignalingSimulator();
        return FullInfra.fromRJSInfra(rjs, diagnosticRecorder, signalingSimulator);
    }

    /** Loads small infra as a RawSignalingInfra */
    public static FullInfra getSmallInfra() {
        try {
            return Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        } catch (IOException | URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    /** Loads tiny infra as a FullInfra */
    public static FullInfra getTinyInfra() {
        try {
            return Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        } catch (IOException | URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    /** returns the blocks on the given routes */
    public static List<Integer> getBlocksOnRoutes(FullInfra infra, List<String> names) {
        var res = new ArrayList<Integer>();
        var routes = new MutableStaticIdxArrayList<Route>();
        for (var name: names)
            routes.add(infra.rawInfra().getRouteFromName(name));
        var candidates = recoverBlocks(
                infra.rawInfra(),
                infra.blockInfra(),
                routes,
                getSignalingSystems(infra)
        );
        assert !candidates.isEmpty();
        for (var candidate : candidates)
            res.addAll(toList(candidate).stream().map(BlockPathElement::getBlock).toList());
        return res;
    }

    /** Returns the idx list of signaling systems */
    private static StaticIdxList<SignalingSystem> getSignalingSystems(FullInfra infra) {
        var res = new MutableStaticIdxArrayList<SignalingSystem>();
        for (int i = 0; i < infra.signalingSimulator().getSigModuleManager().getSignalingSystems(); i++)
            res.add(i);
        return res;
    }

    /** Converts a route + offset into a block location. */
    public static Pathfinding.EdgeLocation<Integer> convertRouteLocation(
            FullInfra infra,
            String routeName,
            long offset
    ) {
        var blocks = getBlocksOnRoutes(infra, List.of(routeName));
        for (var block : blocks) {
            var blockLength = infra.blockInfra().getBlockLength(block);
            if (offset <= blockLength)
                return new Pathfinding.EdgeLocation<>(block, offset);
            offset -= blockLength;
        }
        throw new RuntimeException("Couldn't find route location");
    }

    /** Creates a path from a list of route names and start/end locations */
    public static ChunkPath chunkPathFromRoutes(
            RawSignalingInfra infra,
            List<String> routeNames,
            TrackLocation start,
            TrackLocation end
    ) {
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        for (var name : routeNames) {
            var routeId = infra.getRouteFromName(name);
            for (var chunk : toIntList(infra.getChunksOnRoute(routeId)))
                chunks.add(chunk);
        }
        long startOffset = PathPropertiesImplKt.getOffsetOfTrackLocationOnChunksOrThrow(infra, start, chunks);
        long endOffset = PathPropertiesImplKt.getOffsetOfTrackLocationOnChunksOrThrow(infra, end, chunks);
        return buildChunkPath(infra, chunks, startOffset, endOffset);
    }
}
