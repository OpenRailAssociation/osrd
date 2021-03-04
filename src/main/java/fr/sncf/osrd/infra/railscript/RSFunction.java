package fr.sncf.osrd.infra.railscript;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.railscript.value.RSType;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RSFunction<T extends RSValue> {
    public final String functionName;

    public final String[] argNames;
    public final RSType[] argTypes;

    public final RSType returnsType;

    public final RSExpr<T> body;

    public final int slotsCount;

    public int getArgCount() {
        return argNames.length;
    }

    /**
     * Represents a function in RailScript
     * @param functionName name of the function
     * @param argNames list of the argument names
     * @param argTypes list of the argument types
     * @param returnsType the return type of the function
     * @param body the expression to evaluate when the function is called
     * @param slotsCount the number of slots required to evaluate the function
     */
    public RSFunction(
            String functionName,
            String[] argNames,
            RSType[] argTypes,
            RSType returnsType,
            RSExpr<T> body,
            int slotsCount
    ) {
        assert argNames.length == argTypes.length;
        this.functionName = functionName;
        this.argNames = argNames;
        this.argTypes = argTypes;
        this.returnsType = returnsType;
        this.body = body;
        this.slotsCount = slotsCount;
    }

    /** Creates and type checks a new signal state evaluation function */
    public static <T extends RSValue> RSFunction<T> from(
            String functionName,
            String[] argumentNames,
            RSType[] argumentTypes,
            RSType returnType,
            RSExpr<T> body,
            int slotsCount
    ) throws InvalidInfraException {
        var function = new RSFunction<>(functionName, argumentNames, argumentTypes, returnType, body, slotsCount);
        if (function.body.getType(argumentTypes) != returnType)
            throw new InvalidInfraException("return type mismatch in function" + functionName);
        return function;
    }
}
