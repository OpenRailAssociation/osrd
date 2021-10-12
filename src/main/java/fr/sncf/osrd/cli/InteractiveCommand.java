package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.interactive.InteractiveEndpoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.glassfish.tyrus.server.Server;
import jakarta.websocket.DeploymentException;

@Parameters(commandDescription = "Starts an interactive WebSocket simulation service")
public final class InteractiveCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(fr.sncf.osrd.cli.InteractiveCommand.class);

    @Parameter(
            names = { "-p", "--port" },
            description = "The port to listen on"
    )
    private int port = 9000;

    /** Runs the command, and return a status code */
    public int run() {
        Server server = new Server(
                "localhost",
                port,
                "/websockets",
                null,
                InteractiveEndpoint.class
        );
        try {
            logger.info("The server is starting...");
            server.start();
            System.out.print("Press enter to stop the server.");
            var inputStream = new InputStreamReader(System.in, StandardCharsets.UTF_8);
            new BufferedReader(inputStream).readLine();
        } catch (IOException | DeploymentException e) {
            throw new RuntimeException(e);
        } finally {
            logger.info("The server is shutting down...");
            server.stop();
        }
        return 0;
    }
}