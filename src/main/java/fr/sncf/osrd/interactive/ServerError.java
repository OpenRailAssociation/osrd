package fr.sncf.osrd.interactive;

public class ServerError extends Exception {
    public static final long serialVersionUID = -8927520254317503225L;
    public final ServerMessage message;

    public ServerError(ServerMessage message) {
        this.message = message;
    }
}
