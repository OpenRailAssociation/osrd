package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.railscript.value.RSValue;

public class RSExprState<T extends RSValue> {
    public enum RSExprEvalMode {
        INITIALIZE,
        INPUT_CHANGE,
        DELAY_UPDATE,
    }

    /** The expression this is the state of */
    private final RSExpr<T> rootExpr;

    /** The state of all non-temporary expressions in the call tree */
    final RSValue[] varStates;

    /** The current offset of the variable window */
    int scopeOffset = 0;

    void pushScope(int offset) {
        assert offset >= 0;
        scopeOffset += offset;
    }

    void popScope(int offset) {
        assert offset >= 0;
        scopeOffset -= offset;
        assert scopeOffset >= 0;
    }

    RSValue getValue(int index) {
        return varStates[scopeOffset + index];
    }

    void setValue(int index, RSValue value) {
        varStates[scopeOffset + index] = value;
    }

    /** The current evaluation mode */
    RSExprEvalMode evalMode = RSExprEvalMode.INITIALIZE;

    /** The current delay handler, which is in charge of calling back after a given delay */
    private RSDelayHandler delayHandler = null;

    void planDelayedUpdate(int index, RSValue value, double delay) {
        assert evalMode != RSExprEvalMode.INITIALIZE;
        // TODO: send delay updates
    }

    Infra.State infraState;

    private int lastUpdatedDelaySlot = -1;

    boolean hasDelaySlotChanged(int index) {
        assert evalMode == RSExprEvalMode.DELAY_UPDATE;
        return scopeOffset + index == lastUpdatedDelaySlot;
    }

    RSExprState(RSExpr<T> rootExpr, int stateSize) {
        this.rootExpr = rootExpr;
        this.varStates = new RSValue[stateSize];
    }

    private T eval(Infra.State infraState, RSDelayHandler delayHandler, RSExprEvalMode evalMode) {
        this.scopeOffset = 0;
        this.delayHandler = delayHandler;
        this.evalMode = evalMode;
        this.infraState = infraState;
        var res = rootExpr.evaluate(this);
        assert scopeOffset == 0;
        return res;
    }

    public T evalInit(Infra.State state) {
        return eval(state, null, RSExprEvalMode.INITIALIZE);
    }

    public T evalInputChange(Infra.State infraState, RSDelayHandler delayHandler) {
        return eval(infraState, delayHandler, RSExprEvalMode.INPUT_CHANGE);
    }

    /** Evaluates the result of a delayed update */
    public T evalDelayUpdate(Infra.State infraState, RSDelayHandler delayHandler, int delaySlot, RSValue value) {
        setValue(delaySlot, value);
        lastUpdatedDelaySlot = delaySlot;
        return eval(infraState, delayHandler, RSExprEvalMode.DELAY_UPDATE);
    }
}
