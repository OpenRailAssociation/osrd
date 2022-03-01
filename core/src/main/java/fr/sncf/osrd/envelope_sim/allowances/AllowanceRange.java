package fr.sncf.osrd.envelope_sim.allowances;

public class AllowanceRange {
    public final double beginPos;
    public final double endPos;
    public final AllowanceValue value;

    public AllowanceRange(double beginPos, double endPos, AllowanceValue value) {
        this.beginPos = beginPos;
        this.endPos = endPos;
        this.value = value;
    }
}
