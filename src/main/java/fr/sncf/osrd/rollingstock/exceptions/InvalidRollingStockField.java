package fr.sncf.osrd.rollingstock.exceptions;

public final class InvalidRollingStockField extends InvalidRollingStock {
    static final long serialVersionUID = -1568988911854634262L;

    public final String fieldName;

    public InvalidRollingStockField(String fieldName, String message) {
        super(message);
        this.fieldName = fieldName;
    }
}
