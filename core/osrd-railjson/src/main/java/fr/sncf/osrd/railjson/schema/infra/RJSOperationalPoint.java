package fr.sncf.osrd.railjson.schema.infra;

import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart;
import java.util.List;
import org.jetbrains.annotations.Nullable;

public class RJSOperationalPoint implements Identified {
    public String id;
    public List<RJSOperationalPointPart> parts;

    @Nullable
    public RJSOperationalPointExtensions extensions;

    @Nullable
    public String weight;

    public RJSOperationalPoint(
            String id,
            List<RJSOperationalPointPart> parts,
            @Nullable RJSOperationalPointExtensions extensions,
            @Nullable String weight) {
        this.id = id;
        this.parts = parts;
        this.extensions = extensions;
        this.weight = weight;
    }

    @Override
    public String getID() {
        return id;
    }
}
