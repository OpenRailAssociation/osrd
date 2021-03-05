package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSValue;

public class RSStatefulExpr<T extends RSValue> {
    public final RSExpr<T> rootExpr;
    public final int stateSize;

    public RSStatefulExpr(RSExpr<T> rootExpr, int stateSize) {
        this.rootExpr = rootExpr;
        this.stateSize = stateSize;
    }

    public RSExprState<T> makeState() {
        return new RSExprState<>(rootExpr, stateSize);
    }

    public void accept(RSExprVisitor visitor) throws InvalidInfraException {
        rootExpr.accept(visitor);
    }
}
