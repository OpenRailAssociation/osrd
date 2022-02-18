package fr.sncf.osrd.exceptions;

public class NotImplemented extends OSRDError {
    private static final long serialVersionUID = -6595197131331887742L;
    public static final String osrdErrorType = "not_implemented";

    public NotImplemented() {
        super("Not implemented", ErrorCause.INTERNAL);
    }
}
