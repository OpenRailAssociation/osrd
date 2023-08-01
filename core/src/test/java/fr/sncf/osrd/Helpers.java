package fr.sncf.osrd;

import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;
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
import fr.sncf.osrd.sim_infra.api.LoadedSignalingInfraKt;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.api.Route;
import fr.sncf.osrd.sim_infra.api.SignalingSystem;
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
import java.util.*;


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
            routes.add(getRouteFromName(infra.rawInfra(), name));
        var routeBlocks = LoadedSignalingInfraKt.getRouteBlocks(
                infra.rawInfra(),
                infra.blockInfra(),
                routes,
                getSignalingSystem(infra)
        );
        for (var blockList : routeBlocks)
            res.addAll(toIntList(blockList));
        return res;
    }

    /** Finds the id of the route with the given name */
    private static int getRouteFromName(RawSignalingInfra infra, String name) {
        for (int i = 0; i < infra.getRoutes(); i++) {
            if (name.equals(infra.getRouteName(i)))
                return i;
        }
        throw new RuntimeException("Can't find the given route");
    }

    /** Returns the idx list of signaling systems */
    private static StaticIdxList<SignalingSystem> getSignalingSystem(FullInfra infra) {
        var res = new MutableStaticIdxArrayList<SignalingSystem>();
        for (int i = 0; i < infra.signalingSimulator().getSigModuleManager().getSignalingSystems(); i++)
            res.add(i);
        return res;
    }
}
