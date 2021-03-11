package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.FromJson;
import com.squareup.moshi.ToJson;
import fr.sncf.osrd.infra.railjson.schema.Identified;

public class RJSAspect implements Identified {
    public final String id;

    /** An HTML color */
    public final String color;

    public RJSAspect(String id, String color) {
        this.id = id;
        this.color = color;
    }

    @Override
    public String getID() {
        return id;
    }
}
