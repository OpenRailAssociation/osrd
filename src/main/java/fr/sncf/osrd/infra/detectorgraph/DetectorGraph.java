package fr.sncf.osrd.infra.detectorgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.Graph;
import fr.sncf.osrd.util.CryoMap;

public final class DetectorGraph extends Graph<DetectorNode, TVDSectionPath> {

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final CryoMap<String, DetectorNode> detectorNodeMap = new CryoMap<>();
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final CryoMap<String, TVDSectionPath> tvdSectionPathMap = new CryoMap<>();

}
