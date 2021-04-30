package fr.sncf.osrd.infra.railscript.value;

public class RSOptional<T extends RSValue> implements RSValue{

    public T value;

    @Override
    public boolean deepEquals(RSValue other) {
        if (other.getClass() != RSOptional.class)
            return false;
        var otherOptional = (RSOptional<?>) other;
        return value.deepEquals(otherOptional.value);
    }
}
