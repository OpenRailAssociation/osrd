package fr.sncf.osrd.interactive;

import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import jakarta.websocket.server.PathParam;
import java.io.IOException;
import java.util.HashMap;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@ServerEndpoint(
        value="/chat/{username}",
        encoders = MessageEncoder.class,
        decoders = MessageDecoder.class
)
public class InteractiveEndpoint {

    private Session session;
    private static Set<InteractiveEndpoint> chatEndpoints
      = new CopyOnWriteArraySet<>();
    private static HashMap<String, String> users = new HashMap<>();

    @OnOpen
    public void onOpen(Session session, @PathParam("username") String username) throws IOException {
        this.session = session;
        chatEndpoints.add(this);
        users.put(session.getId(), username);

        Message message = new Message();
        message.from = username;
        message.content = "Connected!";
        broadcast(message);
    }

    @OnMessage
    public void onMessage(Session session, Message message) throws IOException {
        message.from = users.get(session.getId());
        broadcast(message);
    }

    @OnClose
    public void onClose(Session session) throws IOException {
        chatEndpoints.remove(this);
        Message message = new Message();
        message.from = (users.get(session.getId()));
        message.content = ("Disconnected!");
        broadcast(message);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        // Do error handling here
    }

    private static void broadcast(Message message) {
        chatEndpoints.forEach(endpoint -> {
            synchronized (endpoint) {
                try {
                    endpoint.session.getBasicRemote().
                      sendObject(message);
                } catch (IOException | EncodeException e) {
                    e.printStackTrace();
                }
            }
        });
    }
}