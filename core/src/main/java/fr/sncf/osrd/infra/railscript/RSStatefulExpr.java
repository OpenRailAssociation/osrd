package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSValue;

public class RSStatefulExpr<T extends RSValue> {
    public final RSExpr<T> rootExpr;
    public final int argSlotCount;
    public final int delaySlotCount;

    /** Create a new state container for a RailScript expression */
    public RSStatefulExpr(RSExpr<T> rootExpr, int argSlotCount, int delaySlotCount) {
        this.rootExpr = rootExpr;
        this.argSlotCount = argSlotCount;
        this.delaySlotCount = delaySlotCount;
    }

    public RSExprState<T> makeState() {
        return new RSExprState<>(rootExpr, argSlotCount, delaySlotCount);
    }

    public void accept(RSExprVisitor visitor) throws InvalidInfraException {
        rootExpr.accept(visitor);
    }
}
