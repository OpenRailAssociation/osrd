package fr.sncf.osrd.railjson.parser.exceptions;

public class InvalidRollingStock extends Exception {
    static final long serialVersionUID = 4293487429043552500L;

    public InvalidRollingStock(String message) {
        super(message);
    }

    public InvalidRollingStock() {
        super();
    }
}
