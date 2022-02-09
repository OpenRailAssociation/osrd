package fr.sncf.osrd.utils;


/** <p>This class is used as follows:</p>
 * <pre>
 *     var search = new DoubleBinarySearch(0, 10, 4, 0.001);
 *     while (!search.complete()) {
 *         var input = search.getInput();
 *         var output = input * input * input;
 *         search.feedback(output);
 *     }
 * </pre>
 */
public final class DoubleBinarySearch {
    /** The current low bound estimate */
    private double lowBound;
    /** The current high bound estimate */
    private double highBound;
    /** The current input, which is kept in sync to the middle point between lowBound and highBound */
    private double input;
    /** The target output value */
    public final double target;
    /** The acceptable distance to the target */
    public final double targetErrorMargin;
    /** Positive if increasing, negative if decreasing */
    private final double direction;
    /** Whether the search is complete */
    private boolean isComplete;
    /** Whether we have lowered the high bound at least once */
    private boolean hasLoweredHighBound;
    /** Whether we have raised the low bound at least once */
    private boolean hasRaisedLowBound;

    /**
     * Returns a binary search helper.
     * @param lowBound The low initial estimate
     * @param highBound The high initial estimate
     * @param target The target output value
     * @param targetErrorMargin The acceptable error for stopping the search
     * @param decreasing Whether the output decreases when the input increases
     */
    public DoubleBinarySearch(
            double lowBound,
            double highBound,
            double target,
            double targetErrorMargin,
            boolean decreasing
    ) {
        this.lowBound = lowBound;
        this.highBound = highBound;
        this.target = target;
        this.targetErrorMargin = targetErrorMargin;
        this.direction = decreasing ? -1 : 1;
        this.input = estimateInput(lowBound, highBound);
        this.isComplete = false;
        this.hasLoweredHighBound = false;
        this.hasRaisedLowBound = false;
    }

    /** Returns an input estimate */
    private static double estimateInput(double lowBound, double highBound) {
        return (lowBound + highBound) / 2;
    }

    /** Returns true when the search is complete */
    public boolean complete() {
        return isComplete;
    }

    /** Returns the next input of the binary search */
    public double getInput() {
        assert !isComplete;
        return input;
    }

    /** Return the result of the binary search (the input which satisfied the goal) */
    public double getResult() {
        assert isComplete;
        return input;
    }

    /** Feeds back the output of the tested function for the current input */
    public void feedback(double output) {
        assert !isComplete;

        var delta = output - target;
        if (Math.abs(delta) <= targetErrorMargin) {
            isComplete = true;
            return;
        }

        if (SignUtils.conditionalNegate(delta, direction) < 0) {
            lowBound = input;
            hasRaisedLowBound = true;
        } else {
            highBound = input;
            hasLoweredHighBound = true;
        }

        this.input = estimateInput(lowBound, highBound);
    }

    /** Returns true if we have lowered the high bound at least once */
    public boolean hasLoweredHighBound() {
        return hasLoweredHighBound;
    }

    /** Returns true if we have raised the low bound at least once */
    public boolean hasRaisedLowBound() {
        return hasRaisedLowBound;
    }
}
