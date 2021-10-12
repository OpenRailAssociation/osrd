package fr.sncf.osrd.interactive;

import fr.sncf.osrd.interactive.client_messages.ClientMessage;
import jakarta.websocket.*;
import java.io.IOException;

public class ClientMessageDecoder implements Decoder.Text<ClientMessage> {

    @Override
    public ClientMessage decode(String s) throws DecodeException {
        try {
            return ClientMessage.adapter.fromJson(s);
        } catch (IOException e) {
            throw new DecodeException(s, "moshi failed to decode", e);
        }
    }

    @Override
    public boolean willDecode(String s) {
        return s != null;
    }

    @Override
    public void init(EndpointConfig config) {
    }

    @Override
    public void destroy() {
    }
}
