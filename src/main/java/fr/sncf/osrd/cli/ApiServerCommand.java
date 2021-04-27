package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.api.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.PathfindingTracksEndpoint;
import fr.sncf.osrd.api.SimulationEndpoint;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.facets.fallback.FbChain;
import org.takes.facets.fallback.FbStatus;
import org.takes.facets.fallback.TkFallback;
import org.takes.facets.fork.FkRegex;
import org.takes.facets.fork.TkFork;
import org.takes.http.Exit;
import org.takes.http.FtBasic;
import org.takes.rs.RsWithStatus;
import org.takes.tk.TkSlf4j;

import java.io.IOException;

@Parameters(commandDescription = "HTTP API server mode")
public final class ApiServerCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(ApiServerCommand.class);

    @Parameter(
            names = { "-p", "--port" },
            description = "The TCP port to listen on"
    )
    private int port = 8000;

    @Parameter(
            names = { "-i", "--input" },
            description = "The infra input file (supports RailML and RailJSON)",
            required = true
    )
    private String inputPath;

    /** Run the Api Server */
    public int run() {
        try {
            logger.info("parsing the input infrastructure");
            var infra = Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, inputPath);

            // the list of endpoints
            var routes = new TkFork(
                    new FkRegex("/health", ""),
                    new FkRegex("/pathfinding/routes", new PathfindingRoutesEndpoint(infra)),
                    new FkRegex("/pathfinding/tracks", new PathfindingTracksEndpoint(infra)),
                    new FkRegex("/simulation", new SimulationEndpoint(infra))
            );

            // the list of pages which should be displayed on error
            var fallbacks = new FbChain(
                    // if a page isn't found, just return a 404
                    new FbStatus(404, new RsWithStatus(404))
            );

            var serverConfig = new TkSlf4j(new TkFallback(routes, fallbacks));
            var server = new FtBasic(serverConfig, port);
            server.start(Exit.NEVER);
            return 0;
        } catch (IOException ioException) {
            logger.error("IO error", ioException);
            return 1;
        } catch (InvalidInfraException infraException) {
            logger.error("Infra exception", infraException);
            return 1;
        }
    }
}