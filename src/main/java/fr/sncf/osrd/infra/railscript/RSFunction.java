package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.railscript.value.RSType;

public class RSFunction<T extends RSValue> {
    public final String functionName;

    public final String[] argNames;
    public final RSType[] argTypes;

    public final RSType returnsType;

    public final RSExpr<T> body;

    public final int argSlotsCount;
    public final int delaySlotsCount;

    public int getArgCount() {
        return argNames.length;
    }

    /** Represents a function in RailScript */
    public RSFunction(
            String functionName,
            String[] argNames,
            RSType[] argTypes,
            RSType returnsType,
            RSExpr<T> body,
            int argSlotsCount,
            int delaySlotsCount
    ) {
        assert argNames.length == argTypes.length;
        this.functionName = functionName;
        this.argNames = argNames;
        this.argTypes = argTypes;
        this.returnsType = returnsType;
        this.body = body;
        this.argSlotsCount = argSlotsCount;
        this.delaySlotsCount = delaySlotsCount;
    }

    /** Creates and type checks a new signal state evaluation function */
    public static <T extends RSValue> RSFunction<T> from(
            String functionName,
            String[] argumentNames,
            RSType[] argumentTypes,
            RSType returnType,
            RSExpr<T> body,
            int argSlotsCount,
            int delaySlotsCount
    ) throws InvalidInfraException {
        var function = new RSFunction<>(
                functionName, argumentNames, argumentTypes, returnType, body, argSlotsCount, delaySlotsCount);
        if (function.body.getType(argumentTypes) != returnType)
            throw new InvalidInfraException("return type mismatch in function" + functionName);
        return function;
    }
}
