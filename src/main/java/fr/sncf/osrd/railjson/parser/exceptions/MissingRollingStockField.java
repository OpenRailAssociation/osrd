package fr.sncf.osrd.railjson.parser.exceptions;

public final class MissingRollingStockField extends InvalidRollingStock {
    static final long serialVersionUID = -1642047451113737984L;

    public final String fieldName;

    public MissingRollingStockField(String fieldName) {
        this.fieldName = fieldName;
    }
}
