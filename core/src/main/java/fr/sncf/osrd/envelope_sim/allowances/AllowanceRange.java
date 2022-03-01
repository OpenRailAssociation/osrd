package fr.sncf.osrd.envelope_sim.allowances;

/** A range of allowance is a part of the path between [beginPos, endPos] that has a certain allowance value
 *  Together, allowance ranges are supposed to cover the entire path.
 *  If a part of the path has no specified value, the default one is used instead. */
public class AllowanceRange {
    public final double beginPos;
    public final double endPos;
    public final AllowanceValue value;

    /** Constructor */
    public AllowanceRange(double beginPos, double endPos, AllowanceValue value) {
        this.beginPos = beginPos;
        this.endPos = endPos;
        this.value = value;
    }
}
