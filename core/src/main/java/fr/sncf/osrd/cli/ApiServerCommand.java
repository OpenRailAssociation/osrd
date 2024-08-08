package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.api.*;
import fr.sncf.osrd.api.api_v2.conflicts.ConflictDetectionEndpointV2;
import fr.sncf.osrd.api.api_v2.path_properties.PathPropEndpoint;
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlocksEndpointV2;
import fr.sncf.osrd.api.api_v2.project_signals.SignalProjectionEndpointV2;
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationEndpoint;
import fr.sncf.osrd.api.api_v2.stdcm.STDCMEndpointV2;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.Take;
import org.takes.facets.fallback.*;
import org.takes.facets.fork.FkRegex;
import org.takes.facets.fork.TkFork;
import org.takes.http.*;
import org.takes.rs.RsText;
import org.takes.rs.RsWithStatus;
import org.takes.tk.TkSlf4j;

@Parameters(commandDescription = "HTTP API server mode")
public final class ApiServerCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(ApiServerCommand.class);

    @Parameter(
            names = {"-p", "--port"},
            description = "The TCP port to listen on")
    private int port = 8000;

    @Parameter(
            names = {"--editoast-url"},
            description = "The base URL of editoast (used to query infrastructures)")
    private String editoastUrl;

    @Parameter(
            names = {"--editoast-authorization"},
            description = "The HTTP Authorization header sent to editoast")
    private String editoastAuthorization;

    @Parameter(
            names = {"-j", "--threads"},
            description = "The number of threads to serve requests from")
    private Integer threads;

    private String getEditoastUrl() {
        if (editoastUrl == null) {
            System.err.println("The use of MIDDLEWARE_BASE_URL is deprecated. Use CORE_EDITOAST_URL instead.");
            editoastUrl = System.getenv("MIDDLEWARE_BASE_URL");
        }

        if (editoastUrl == null)
            throw new RuntimeException("No editoast base url specified. "
                    + "Use '--editoast-url' option or the 'CORE_EDITOAST_URL' environment variable");

        if (!editoastUrl.endsWith("/")) return editoastUrl + "/";
        return editoastUrl;
    }

    /** Run the Api Server */
    public int run() {
        var editoastUrl = getEditoastUrl();
        var httpClient =
                new OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build();
        var infraManager = new InfraManager(editoastUrl, editoastAuthorization, httpClient);
        var electricalProfileSetManager =
                new ElectricalProfileSetManager(editoastUrl, editoastAuthorization, httpClient);

        var maxMemory = String.format("%.2f", Runtime.getRuntime().maxMemory() / (double) (1 << 30));
        logger.info("starting the API server with max {}Gi of java heap", maxMemory);
        try {
            // the list of endpoints
            var routes = new TkFork(
                    new FkRegex("/health", ""),
                    new FkRegex("/v2/pathfinding/blocks", new PathfindingBlocksEndpointV2(infraManager)),
                    new FkRegex("/v2/path_properties", new PathPropEndpoint(infraManager)),
                    new FkRegex(
                            "/v2/standalone_simulation",
                            new SimulationEndpoint(infraManager, electricalProfileSetManager)),
                    new FkRegex("/v2/signal_projection", new SignalProjectionEndpointV2(infraManager)),
                    new FkRegex("/v2/conflict_detection", new ConflictDetectionEndpointV2()),
                    new FkRegex("/cache_status", new InfraCacheStatusEndpoint(infraManager)),
                    new FkRegex("/version", new VersionEndpoint()),
                    new FkRegex("/v2/stdcm", new STDCMEndpointV2(infraManager)),
                    new FkRegex("/infra_load", new InfraLoadEndpoint(infraManager)));
            var monitoringType = System.getenv("CORE_MONITOR_TYPE");
            Take monitoredRoutes = routes;
            if ("opentelemetry".equals(monitoringType)) {
                logger.info("wrapping endpoints in opentelemetry");
                monitoredRoutes = new TkOpenTelemetry(routes);
            }
            if ("datadog".equals(monitoringType)) {
                logger.info("wrapping endpoints in datadog");
                monitoredRoutes = new TkDataDog(routes);
            }

            // the list of pages which should be displayed on error
            var fallbacks = new FbChain(
                    // if a page isn't found, just return a 404
                    new FbStatus(404, new RsWithStatus(new RsText("Not found"), 404)));

            var serverConfig = new TkSlf4j(new TkFallback(monitoredRoutes, fallbacks));
            var serverSafety = new BkSafe(new BkBasic(serverConfig));
            var serverBack = threads != null ? new BkParallel(serverSafety, threads) : new BkParallel(serverSafety);
            var serverFront = new FtBasic(serverBack, port);
            serverFront.start(Exit.NEVER);
            return 0;
        } catch (IOException ioException) {
            logger.error("IO error", ioException);
            return 1;
        }
    }
}
