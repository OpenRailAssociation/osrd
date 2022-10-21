package fr.sncf.osrd;


import com.squareup.moshi.JsonAdapter;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
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
    /** Parse all serialized .json rolling stock files and add these to the given map */
    public static List<RJSRollingStock> parseRollingStockDir(Path dirPath) throws IOException, InvalidRollingStock {
        var jsonMatcher = FileSystems.getDefault().getPathMatcher("glob:**.json");
        var rollingStocksPaths = Files.list(dirPath)
                .filter((path) -> path.toFile().isFile())
                .filter(jsonMatcher::matches)
                .toList();

        var res = new ArrayList<RJSRollingStock>();
        for (var filePath : rollingStocksPaths)
            res.add(MoshiUtils.deserialize(RJSRollingStock.adapter, filePath));
        res.sort(Comparator.comparing(x -> x.name)); // Prevents different behaviors on different OS when running tests
        return res;
    }

    public static List<RJSRollingStock> getExampleRollingStocks() throws InvalidRollingStock, IOException {
        return parseRollingStockDir(getResourcePath("rolling_stocks/"));
    }

    public static RJSInfra getExampleInfra(String infraPath) throws IOException, URISyntaxException {
        return deserializeResource(RJSInfra.adapter, infraPath);
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
}
