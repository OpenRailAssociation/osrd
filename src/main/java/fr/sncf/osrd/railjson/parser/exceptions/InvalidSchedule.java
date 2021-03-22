package fr.sncf.osrd.railjson.parser.exceptions;

public class InvalidSchedule extends Exception {
    static final long serialVersionUID = 1068679247089983594L;

    public InvalidSchedule(String message) {
        super(message);
    }
}
