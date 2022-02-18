package fr.sncf.osrd.railjson.parser.exceptions;

public class UnknownRollingStock extends InvalidSchedule {
    private static final long serialVersionUID = 7255918937277778058L;
    public static final String osrdErrorType = "unknown_stock";

    public final String rollingStockID;

    public UnknownRollingStock(String rollingStockID) {
        super("unknown rolling stock");
        this.rollingStockID = rollingStockID;
    }
}
