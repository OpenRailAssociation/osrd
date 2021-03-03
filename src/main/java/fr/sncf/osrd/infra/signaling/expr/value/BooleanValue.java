package fr.sncf.osrd.infra.signaling.expr.value;

public final class BooleanValue implements IExprValue {
    public final boolean value;

    public static final BooleanValue True = new BooleanValue(true);
    public static final BooleanValue False = new BooleanValue(false);

    private BooleanValue(boolean value) {
        this.value = value;
    }

    /** Turn a boolean into an expression */
    public static BooleanValue from(boolean bool) {
        if (bool)
            return True;
        return False;
    }
}
