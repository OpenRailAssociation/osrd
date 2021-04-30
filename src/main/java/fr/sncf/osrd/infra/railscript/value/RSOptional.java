package fr.sncf.osrd.infra.railscript.value;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class RSOptional<T extends RSValue> implements RSValue{

    public T value;

    public RSOptional(T value) {
        this.value = value;
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(RSValue other) {
        if (other.getClass() != RSOptional.class)
            return false;
        var otherOptional = (RSOptional<?>) other;
        return value.deepEquals(otherOptional.value);
    }
}
