package fr.sncf.osrd.railjson.schema.infra.signaling;

import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;

public class RJSAspect implements Identified {
    public String id;

    /** An HTML color */
    public String color;

    public List<RJSAspectConstraint> constraints;

    /** Create an RJSAspect */
    public RJSAspect(String id, String color, List<RJSAspectConstraint> constraints) {
        this.id = id;
        this.color = color;
        this.constraints = constraints;
    }

    @Override
    public String getID() {
        return id;
    }
}
