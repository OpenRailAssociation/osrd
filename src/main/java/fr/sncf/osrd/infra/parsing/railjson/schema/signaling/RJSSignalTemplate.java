package fr.sncf.osrd.infra.parsing.railjson.schema.signaling;

import com.squareup.moshi.FromJson;
import com.squareup.moshi.Json;
import com.squareup.moshi.ToJson;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.Identified;

import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignalTemplate implements Identified {
    public final String id;

    /**
     * A template for a signal. It contains references to parameters which are specified inside actual signals.
     * @param id The identifier for the template
     * @param defaultAspect The aspect the signal shows when nothing happens
     * @param rules The list of rules that apply
     */
    public RJSSignalTemplate(
            String id,
            ID<RJSAspect> defaultAspect,
            List<RJSSignalRule> rules
    ) {
        this.id = id;
        this.defaultAspect = defaultAspect;
        this.rules = rules;
    }

    @Override
    public String getID() {
        return id;
    }

    /** The aspect shown when no rule triggers */
    @Json(name = "default_aspect")
    public final ID<RJSAspect> defaultAspect;

    public final List<RJSSignalRule> rules;

    public static final class ParameterRef<T> {
        public final String parameterName;

        public ParameterRef(String parameterName) {
            this.parameterName = parameterName;
        }

        public static class Adapter {
            @ToJson
            String toJson(ParameterRef<?> parameterRef) {
                return parameterRef.parameterName;
            }

            @FromJson
            <T> ParameterRef<T> fromJson(String str) {
                return new ParameterRef<T>(str);
            }
        }
    }

}
