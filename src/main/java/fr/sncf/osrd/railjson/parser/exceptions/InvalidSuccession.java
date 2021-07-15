package fr.sncf.osrd.railjson.parser.exceptions;

public class InvalidSuccession extends Exception {
    static final long serialVersionUID = 1068679247089984566L;

    public InvalidSuccession(String message) {
        super(message);
    }

    public InvalidSuccession() {
        super();
    }
}
