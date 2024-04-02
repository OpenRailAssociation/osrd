package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.api.*;
import fr.sncf.osrd.api.pathfinding.PathfindingBlocksEndpoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import io.sentry.Sentry;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.Response;
import org.takes.Take;
import org.takes.facets.fallback.*;
import org.takes.facets.fork.FkRegex;
import org.takes.facets.fork.TkFork;
import org.takes.http.*;
import org.takes.misc.Opt;
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
            names = {"--sentry-dsn"},
            description = "The sentry DSN")
    private String sentryDsn;

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
        FbSentry.init(sentryDsn);
        var editoastUrl = getEditoastUrl();
        var httpClient =
                new OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build();
        var infraManager = new InfraManager(editoastUrl, editoastAuthorization, httpClient, false);
        var electricalProfileSetManager =
                new ElectricalProfileSetManager(editoastUrl, editoastAuthorization, httpClient);

        var maxMemory = String.format("%.2f", Runtime.getRuntime().maxMemory() / (double) (1 << 30));
        logger.info("starting the API server with max {}Gi of java heap", maxMemory);
        try {
            // the list of endpoints
            var routes = new TkFork(
                    new FkRegex("/health", ""),
                    new FkRegex("/pathfinding/routes", new PathfindingBlocksEndpoint(infraManager)),
                    new FkRegex(
                            "/standalone_simulation",
                            new StandaloneSimulationEndpoint(infraManager, electricalProfileSetManager)),
                    new FkRegex("/project_signals", new SignalProjectionEndpoint(infraManager)),
                    new FkRegex("/detect_conflicts", new ConflictDetectionEndpoint()),
                    new FkRegex("/cache_status", new InfraCacheStatusEndpoint(infraManager)),
                    new FkRegex("/version", new VersionEndpoint()),
                    new FkRegex("/stdcm", new STDCMEndpoint(infraManager)),
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
                    new FbStatus(404, new RsWithStatus(new RsText("Not found"), 404)), new FbSentry());

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

    private static final class FbSentry implements Fallback {
        public static void init(String sentryDsn) {
            if (sentryDsn != null) Sentry.init(options -> options.setDsn(sentryDsn));
        }

        @Override
        public Opt<Response> route(RqFallback req) {
            Sentry.captureException(req.throwable());
            return new Opt.Single<>(new RsWithStatus(new RsText(req.throwable().getMessage()), req.code()));
        }
    }
}
