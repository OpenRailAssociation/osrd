package fr.sncf.osrd.infra;

public class DataIntegrityException extends Exception {
    public DataIntegrityException(String message) {
        super(message);
    }

    public DataIntegrityException(String message, Throwable err) {
        super(message, err);
    }
}
