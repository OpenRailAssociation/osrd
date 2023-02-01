package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.RangeMap;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.*;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.EnumMap;
import java.util.Map;

public class SwitchBranchImpl implements SwitchBranch {

    public Switch switchRef;
    int index;
    public final String srcPort;
    public final String dstPort;

    /** static mapping from direction to empty map. Avoids unnecessary object instantiations */
    private static final EnumMap<Direction, RangeMap<Double, Double>> emptyMap = new EnumMap<>(Map.of(
            Direction.FORWARD, ImmutableRangeMap.of(),
            Direction.BACKWARD, ImmutableRangeMap.of()
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
    public EnumMap<Direction, RangeMap<Double, Double>> getGradients() {
        return emptyMap;
    }

    @Override
    public EnumMap<Direction, RangeMap<Double, SpeedLimits>> getSpeedSections() {
        return new EnumMap<>(Map.of(
                Direction.FORWARD, ImmutableRangeMap.of(),
                Direction.BACKWARD, ImmutableRangeMap.of()
        ));
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
    public ImmutableRangeMap<Double, LoadingGaugeConstraint> getLoadingGaugeConstraints() {
        return ImmutableRangeMap.of();
    }

    @Override
    public ImmutableRangeMap<Double, String> getVoltages() {
        return ImmutableRangeMap.of();
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
