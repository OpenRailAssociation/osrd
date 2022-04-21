package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.utils.DoubleRangeMap;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.EnumMap;
import java.util.Map;

public class SwitchBranchImpl implements SwitchBranch {

    public Switch switchRef;
    int index;
    public final String srcPort;
    public final String dstPort;

    /** static mapping from direction to empty map. Avoids unnecessary object instantiations */
    private static final EnumMap<Direction, DoubleRangeMap> emptyMap = new EnumMap<>(Map.of(
            Direction.FORWARD, new DoubleRangeMap(),
            Direction.BACKWARD, new DoubleRangeMap()
    ));

    /** Constructor */
    public SwitchBranchImpl(String srcPort, String dstPort) {
        this.srcPort = srcPort;
        this.dstPort = dstPort;
    }

    @Override
    public Switch getSwitch() {
        return switchRef;
    }

    @Override
    public ImmutableList<Detector> getDetectors() {
        return ImmutableList.of();
    }

    @Override
    public EnumMap<Direction, DoubleRangeMap> getGradients() {
        return emptyMap;
    }

    @Override
    public EnumMap<Direction, DoubleRangeMap> getSpeedSections() {
        return emptyMap;
    }

    @Override
    public int getIndex() {
        return index;
    }

    @Override
    public String getID() {
        return String.format("SwitchID=%s, src=%s, dst=%s", switchRef.getID(), srcPort, dstPort);
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("switchRef.ID", switchRef.getID())
                .add("index", index)
                .add("srcPort", srcPort)
                .add("dstPort", dstPort)
                .toString();
    }
}
