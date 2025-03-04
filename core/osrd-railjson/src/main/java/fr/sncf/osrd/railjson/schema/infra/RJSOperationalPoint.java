package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart;
import java.util.List;
import org.jetbrains.annotations.Nullable;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPoint implements Identified {
    public String id;
    public List<RJSOperationalPointPart> parts;

    @Nullable
    public RJSOperationalPointExtensions extensions;

    @Nullable
    public String weight;

    @Nullable
    @Json(name = "is_station")
    public Boolean isStation;

    public RJSOperationalPoint(
            String id,
            List<RJSOperationalPointPart> parts,
            @Nullable RJSOperationalPointExtensions extensions,
            @Nullable String weight,
            @Nullable Boolean isStation) {
        this.id = id;
        this.parts = parts;
        this.extensions = extensions;
        this.weight = weight;
        this.isStation = isStation;
    }

    @Override
    public String getID() {
        return id;
    }
}
