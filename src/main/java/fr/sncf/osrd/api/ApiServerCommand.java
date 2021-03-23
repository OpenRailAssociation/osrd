package fr.sncf.osrd.api;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import org.takes.facets.fallback.FbChain;
import org.takes.facets.fallback.FbStatus;
import org.takes.facets.fallback.TkFallback;
import org.takes.facets.fork.FkRegex;
import org.takes.facets.fork.TkFork;
import org.takes.http.Exit;
import org.takes.http.FtBasic;
import org.takes.rs.RsText;
import org.takes.rs.RsWithStatus;
import org.takes.tk.TkSlf4j;

import java.io.IOException;

@Parameters(commandDescription = "HTTP API server mode")
public final class ApiServerCommand {
    @Parameter(
            names = { "-p", "--port" },
            description = "The TCP port to listen on"
    )
    private int port = 8000;

    /** Run Api Server */
    public void run() throws IOException {
        var routes = new TkFork(
                new FkRegex("/health", "")
        );
        var serverConfig = new TkSlf4j(new TkFallback(routes, new FbChain(new FbStatus(404, new RsWithStatus(404)))));
        var server = new FtBasic(serverConfig, port);
        server.start(Exit.NEVER);
    }
}