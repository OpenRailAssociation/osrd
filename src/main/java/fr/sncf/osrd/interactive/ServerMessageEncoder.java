package fr.sncf.osrd.interactive;

import jakarta.websocket.EncodeException;
import jakarta.websocket.Encoder;
import jakarta.websocket.EndpointConfig;

public class ServerMessageEncoder implements Encoder.Text<ServerMessage> {
    @Override
    public String encode(ServerMessage object) throws EncodeException {
        return ServerMessage.adapter.toJson(object);
    }

    @Override
    public void init(EndpointConfig config) {
    }

    @Override
    public void destroy() {
    }
}
