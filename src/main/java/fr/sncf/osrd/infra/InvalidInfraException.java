package fr.sncf.osrd.infra;

public class InvalidInfraException extends Exception {
    public InvalidInfraException(String message) {
        super(message);
    }

    public InvalidInfraException(String message, Throwable err) {
        super(message, err);
    }
}
