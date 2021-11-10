package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.api.InfraCacheStatusEndpoint;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.PathfindingTracksEndpoint;
import fr.sncf.osrd.api.SimulationEndpoint;
import io.sentry.Sentry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.Response;
import org.takes.facets.fallback.*;
import org.takes.facets.fork.FkRegex;
import org.takes.facets.fork.TkFork;
import org.takes.http.Exit;
import org.takes.http.FtBasic;
import org.takes.misc.Opt;
import org.takes.rs.RsText;
import org.takes.rs.RsWithStatus;
import org.takes.tk.TkSlf4j;
import org.takes.http.BkParallel;
import org.takes.http.BkSafe;
import org.takes.http.BkBasic;
import java.io.IOException;

@Parameters(commandDescription = "HTTP API server mode")
public final class ApiServerCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(ApiServerCommand.class);

    static final int DEFAULT_API_THREADS = 4;

    @Parameter(
            names = { "-p", "--port" },
            description = "The TCP port to listen on"
    )
    private int port = 8000;

    @Parameter(
            names = {"--url" },
            description = "The base URL used to query infrastructures"
    )
    private String middlewareBaseUrl;

    private String getMiddlewareBaseUrl() {
        if (middlewareBaseUrl == null)
            middlewareBaseUrl = System.getenv("MIDDLEWARE_BASE_URL");

        if (middlewareBaseUrl == null)
            throw new RuntimeException(
                "No middleware base url specified. Use '--url' option or 'MIDDLEWARE_BASE_URL' environment variable");

        if (!middlewareBaseUrl.endsWith("/"))
            return middlewareBaseUrl + "/";
        return middlewareBaseUrl;
    }


    /** Run the Api Server */
    public int run() {
        FbSentry.init();
        var authorizationToken = System.getenv("FETCH_INFRA_AUTHORIZATION");
        var infraManager = new InfraManager(getMiddlewareBaseUrl(), authorizationToken);

        try {
            // the list of endpoints
            var routes = new TkFork(
                    new FkRegex("/health", ""),
                    new FkRegex("/pathfinding/routes", new PathfindingRoutesEndpoint(infraManager)),
                    new FkRegex("/pathfinding/tracks", new PathfindingTracksEndpoint(infraManager)),
                    new FkRegex("/simulation", new SimulationEndpoint(infraManager)),
                    new FkRegex("/cache_status", new InfraCacheStatusEndpoint(infraManager))
            );

            // the list of pages which should be displayed on error
            var fallbacks = new FbChain(
                    // if a page isn't found, just return a 404
                    new FbStatus(404, new RsWithStatus(new RsText("Not found"), 404)),
                    new FbSentry()
            );

            // parse the number of API threads from the environment, if present
            int threadCount = DEFAULT_API_THREADS;
            var envThreadCount = System.getenv("OSRD_API_THREADS");
            if (envThreadCount != null)
                threadCount = Integer.parseInt(envThreadCount);

            var serverConfig = new TkSlf4j(new TkFallback(routes, fallbacks));
            var serverBack = new BkParallel(new BkSafe(new BkBasic(serverConfig)), threadCount);
            var serverFront = new FtBasic(serverBack, port);
            serverFront.start(Exit.NEVER);
            return 0;
        } catch (IOException ioException) {
            logger.error("IO error", ioException);
            return 1;
        }
    }

    private static final class FbSentry implements Fallback {
        public static void init() {
            var sentryDSN = System.getenv("SENTRY_DSN");
            if (sentryDSN != null)
                Sentry.init(options -> options.setDsn(sentryDSN));
        }

        @Override
        public Opt<Response> route(RqFallback req) {
            Sentry.captureException(req.throwable());
            return new Opt.Single<>(new RsWithStatus(new RsText(req.throwable().getMessage()), req.code()));
        }
    }
}
