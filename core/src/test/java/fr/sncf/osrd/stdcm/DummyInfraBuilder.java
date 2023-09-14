package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.geom.LineString;
import fr.sncf.osrd.sim_infra.api.*;
import fr.sncf.osrd.sim_infra.impl.NeutralSection;
import fr.sncf.osrd.utils.Direction;
import fr.sncf.osrd.utils.DistanceRangeMap;
import fr.sncf.osrd.utils.indexing.*;
import fr.sncf.osrd.utils.units.DistanceList;
import fr.sncf.osrd.utils.units.Speed;
import kotlin.NotImplementedError;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** This class is used to create a minimal infra to be used on STDCM tests, with a simple block graph. */
public class DummyInfraBuilder {

    public final RawSignalingInfra rawInfra = null;
    public final BlockInfra blockInfra = null;

    /** get the FullInfra */
    public FullInfra fullInfra() {
        return new FullInfra(
                null,
                rawInfra,
                null,
                blockInfra,
                null
        );
    }

    /** Creates a block going from nodes `entry` to `exit` of length 100, named $entry->$exit */
    public int addBlock(String entry, String exit) {
        return addBlock(entry, exit, 100);
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit */
    public int addBlock(String entry, String exit, long length) {
        return addBlock(entry, exit, length, Double.POSITIVE_INFINITY);
    }

    /** Creates a block going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed */
    public int addBlock(String entry, String exit, long length, double allowedSpeed) {
        var name = String.format("%s->%s", entry, exit);
        throw new NotImplementedError();
    }
}
