package fr.sncf.osrd.infra.railscript.value;

public final class RSBool implements RSValue {
    public final boolean value;

    public static final RSBool True = new RSBool(true);
    public static final RSBool False = new RSBool(false);

    private RSBool(boolean value) {
        this.value = value;
    }

    /** Turn a boolean into an expression */
    public static RSBool from(boolean bool) {
        if (bool)
            return True;
        return False;
    }

    @Override
    public int hashCode() {
        return Boolean.hashCode(value);
    }

    @Override
    public boolean equals(Object obj) {
        return obj == this;
    }

    @Override
    public boolean deepEquals(RSValue other) {
        return equals(other);
    }
}
