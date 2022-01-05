package fr.sncf.osrd.envelope;

import fr.sncf.osrd.utils.SwingUtils;
import org.math.plot.Plot2DPanel;
import javax.swing.JPanel;

public class EnvelopeDebug {
    /** Creates a plot panel for this envelope */
    public static JPanel plotPanel(Envelope envelope) {
        // create your PlotPanel (you can use it as a JPanel)
        Plot2DPanel plot = new Plot2DPanel();

        // add a line plot to the PlotPanel
        for (int i = 0; i < envelope.size(); i++) {
            var lineName = String.format("part %d", i);
            var part = envelope.get(i);
            var positions = part.clonePositions();
            var speeds = part.cloneSpeeds();
            // workaround https://github.com/yannrichet/jmathplot/issues/5
            if (part.pointCount() == 2) {
                var newPositions = new double[] { positions[0], speeds[0] };
                var newSpeeds = new double[] { positions[1], speeds[1] };
                positions = newPositions;
                speeds = newSpeeds;
            }
            plot.addLinePlot(lineName, positions, speeds);
        }
        return plot;
    }

    /** Shows an interactive plot of the envelope */
    public static void plot(Envelope envelope) {
        SwingUtils.debugPanel("Envelope", () -> plotPanel(envelope));
    }
}
