package fr.sncf.osrd.interactive;

import fr.sncf.osrd.interactive.client_messages.ClientMessage;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

@ServerEndpoint(
        value = "/simulate",
        encoders = ServerMessageEncoder.class,
        decoders = ClientMessageDecoder.class
)
public class InteractiveEndpoint {
    static final Logger logger = LoggerFactory.getLogger(InteractiveEndpoint.class);

    private Session session;
    private final InteractiveSimulation interactiveSimulation;

    public InteractiveEndpoint() {
        this.interactiveSimulation = new InteractiveSimulation(this::sendResponse);
    }

    @OnOpen
    public void onOpen(Session session) {
        logger.info("opened session");
        this.session = session;
    }

    @OnMessage
    public void onMessage(Session session, ClientMessage message) throws IOException {
        logger.info("received message");
        message.run(interactiveSimulation);
    }

    @OnClose
    public void onClose(Session session) throws IOException {
    }

    private void sendResponse(ServerMessage message) throws IOException {
        try {
            session.getBasicRemote().sendObject(message);
        } catch (EncodeException e) {
            throw new IOException("failed to encode the response", e);
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        logger.error("woops", throwable);
    }
}