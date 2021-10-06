package fr.sncf.osrd.interactive;

import java.io.IOException;

public interface ResponseCallback {
    void send(ServerMessage message) throws IOException;
}
