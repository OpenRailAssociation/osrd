package fr.sncf.osrd.infra;

public class InvalidInfraException extends Exception {
    private static final long serialVersionUID = -9076779692113899128L;

    public InvalidInfraException(String message) {
        super(message);
    }

    public InvalidInfraException(String message, Throwable err) {
        super(message, err);
    }
}
