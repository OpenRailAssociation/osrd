package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.utils.DeepComparable;

import java.util.Arrays;

public class RSExprState<T extends RSValue> implements DeepComparable<RSExprState<?>> {
    @Override
    public boolean deepEquals(RSExprState<?> other) {
        if (other.rootExpr != rootExpr)
            return false;
        return Arrays.equals(delayCurrentStates, other.delayCurrentStates)
                && Arrays.equals(delayLaggingStates, other.delayLaggingStates);
    }

    public enum RSExprEvalMode {
        INITIALIZE,
        INPUT_CHANGE,
        DELAY_UPDATE,
    }

    /** The expression this is the state of */
    private final transient RSExpr<T> rootExpr;

    // region PERSISTENT_STATE
    private final RSValue[] delayLaggingStates;
    private final RSValue[] delayCurrentStates;
    // endregion

    // region CALL_STATE
    transient InfraState infraState;
    transient RSExprEvalMode evalMode = RSExprEvalMode.INITIALIZE;
    final transient RSValue[] argStates;
    transient int argScopeOffset = 0;
    transient int delayScopeOffset = 0;
    private transient int lastUpdatedDelaySlot = -1;
    private transient RSDelayHandler delayHandler = null;
    // endregion

    void pushScope(int argScopeOffset, int delayScopeOffset) {
        assert argScopeOffset >= 0;
        assert delayScopeOffset >= 0;
        this.argScopeOffset += argScopeOffset;
        this.delayScopeOffset += delayScopeOffset;
    }

    void popScope(int argScopeOffset, int delayScopeOffset) {
        assert argScopeOffset <= this.argScopeOffset;
        assert delayScopeOffset <= this.delayScopeOffset;
        this.argScopeOffset -= argScopeOffset;
        this.delayScopeOffset -= delayScopeOffset;
    }

    RSValue getArgValue(int index) {
        return argStates[argScopeOffset + index];
    }

    RSValue getDelayLaggingValue(int index) {
        return delayLaggingStates[delayScopeOffset + index];
    }

    RSValue getDelayCurrentValue(int index) {
        return delayCurrentStates[delayScopeOffset + index];
    }

    void setArgValue(int index, RSValue value) {
        argStates[argScopeOffset + index] = value;
    }

    void setDelayLaggingValue(int index, RSValue value) {
        delayLaggingStates[delayScopeOffset + index] = value;
    }

    void setDelayCurrentValue(int index, RSValue value) {
        delayCurrentStates[delayScopeOffset + index] = value;
    }

    void planDelayedUpdate(int index, RSValue value, double delay) {
        assert evalMode != RSExprEvalMode.INITIALIZE;
        delayHandler.planDelayedUpdate(delayScopeOffset + index, value, delay);
    }

    boolean hasDelaySlotChanged(int index) {
        assert evalMode == RSExprEvalMode.DELAY_UPDATE;
        return argScopeOffset + index == lastUpdatedDelaySlot;
    }

    public RSExprState(RSExpr<T> rootExpr, int argSlotCount, int delaySlotCount) {
        this.rootExpr = rootExpr;
        this.argStates = new RSValue[argSlotCount];
        this.delayCurrentStates = new RSValue[delaySlotCount];
        this.delayLaggingStates = new RSValue[delaySlotCount];
    }

    private T eval(InfraState infraState, RSDelayHandler delayHandler, RSExprEvalMode evalMode) {
        this.argScopeOffset = 0;
        this.delayHandler = delayHandler;
        this.evalMode = evalMode;
        this.infraState = infraState;
        var res = rootExpr.evaluate(this);
        assert argScopeOffset == 0;
        assert delayScopeOffset == 0;
        return res;
    }

    public T evalInit(InfraState state) {
        return eval(state, null, RSExprEvalMode.INITIALIZE);
    }

    public T evalInputChange(InfraState infraState, RSDelayHandler delayHandler) {
        return eval(infraState, delayHandler, RSExprEvalMode.INPUT_CHANGE);
    }

    /** Evaluates the result of a delayed update */
    public T evalDelayUpdate(InfraState infraState, RSDelayHandler delayHandler, int delaySlot, RSValue value) {
        setDelayLaggingValue(delaySlot, value);
        lastUpdatedDelaySlot = delaySlot;
        return eval(infraState, delayHandler, RSExprEvalMode.DELAY_UPDATE);
    }
}