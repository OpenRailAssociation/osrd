package fr.sncf.osrd.envelope_sim;

public interface PhysicsPath {
    /** The length of the path, in meters */
    double getLength();

    /** The average slope on a given range, in meters per kilometers */
    double getAverageGrade(double begin, double end);

    /** Finds the next position for which getAverageGrade(position, position - length) is greater than gradeThreshold
     * @param position the starting point of the search
     * @param endPos the position where the search ends
     * @param length the length of the search window (the length of the train)
     * @param gradeThreshold the function will return for any grade greater than gradeThreshold
     * @return the position of the end of the next high grade area, or endPos
     */
    double findHighGradePosition(double position, double endPos, double length, double gradeThreshold);
}
