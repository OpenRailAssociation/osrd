package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.FromJson;
import com.squareup.moshi.ToJson;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.Identified;

public class RJSAspect implements Identified {
    public final String id;

    public RJSAspect(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }

    /** A moshi adapter for RJSAspect serialization */
    public static class Adapter {
        @ToJson
        String toJson(RJSAspect aspect) {
            return aspect.id;
        }

        @FromJson
        RJSAspect fromJson(String str) {
            return new RJSAspect(str);
        }
    }
}
