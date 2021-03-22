package fr.sncf.osrd.schedule.exceptions;

public class UnknownRollingStock extends InvalidSchedule {
    static final long serialVersionUID = -4584084079930478390L;

    public final String rollingStockID;

    public UnknownRollingStock(String rollingStockID) {
        super("unknown rolling stock");
        this.rollingStockID = rollingStockID;
    }
}
