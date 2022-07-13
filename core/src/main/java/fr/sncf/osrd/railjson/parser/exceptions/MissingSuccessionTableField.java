package fr.sncf.osrd.railjson.parser.exceptions;

public final class MissingSuccessionTableField extends InvalidSuccession {
    private static final long serialVersionUID = -449949414344839739L;
    public static final String osrdErrorType = "missing_table";

    public final String fieldName;

    public MissingSuccessionTableField(String fieldName) {
        super(String.format("missing field {%s}", fieldName));
        this.fieldName = fieldName;
    }
}