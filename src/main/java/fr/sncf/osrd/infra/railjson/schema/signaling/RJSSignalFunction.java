package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.FromJson;
import com.squareup.moshi.Json;
import com.squareup.moshi.ToJson;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.Identified;

import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignalFunction implements Identified {
    @Json(name = "function_name")
    public final String functionName;

    /** The list of the names of the argument of the function. Types are deduced from the AST */
    public final String[] arguments;

    /** The aspect shown when no rule triggers */
    @Json(name = "default_aspects")
    public final ID<RJSAspect>[] defaultAspects;

    /** A collection of aspects, along with the condition that must be verified for the aspect to be shown */
    public final Map<ID<RJSAspect>, RJSSignalExpr> rules;

    /**
     * A template for a signal. It contains references to parameters which are specified inside actual signals.
     * @param functionName The identifier for the template
     * @param arguments the function parameters
     * @param defaultAspects The aspect the signal shows when nothing happens
     * @param rules The list of rules that apply
     */
    public RJSSignalFunction(
            String functionName,
            String[] arguments,
            ID<RJSAspect>[] defaultAspects,
            Map<ID<RJSAspect>, RJSSignalExpr> rules
    ) {
        this.functionName = functionName;
        this.arguments = arguments;
        this.defaultAspects = defaultAspects;
        this.rules = rules;
    }

    @Override
    public String getID() {
        return functionName;
    }

    public static final class ArgumentRef<T> {
        @Json(name = "argument_name")
        public final String argumentName;

        public ArgumentRef(String argumentName) {
            this.argumentName = argumentName;
        }

        public static class Adapter {
            @ToJson
            String toJson(ArgumentRef<?> argumentRef) {
                return argumentRef.argumentName;
            }

            @FromJson
            <T> ArgumentRef<T> fromJson(String str) {
                return new ArgumentRef<T>(str);
            }
        }
    }
}
