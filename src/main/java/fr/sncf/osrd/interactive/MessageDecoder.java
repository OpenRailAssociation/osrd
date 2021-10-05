package fr.sncf.osrd.interactive;

import jakarta.websocket.*;
import java.io.IOException;

public class MessageDecoder implements Decoder.Text<Message> {
    @Override
    public void init(EndpointConfig config) {

    }

    @Override
    public void destroy() {

    }

    @Override
    public Message decode(String s) throws DecodeException {
        try {
            return Message.adapter.fromJson(s);
        } catch (IOException e) {
            throw new DecodeException(s, "moshi failed to decode", e);
        }
    }

    @Override
    public boolean willDecode(String s) {
        return s != null;
    }
}
