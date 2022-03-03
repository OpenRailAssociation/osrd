package fr.sncf.osrd.railjson.parser.exceptions;

public final class MissingSuccessionTableField extends InvalidSuccession {
    static final long serialVersionUID = -1642047451113466434L;

    public final String fieldName;

    public MissingSuccessionTableField(String fieldName) {
        this.fieldName = fieldName;
    }
}