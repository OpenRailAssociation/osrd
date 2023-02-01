package fr.sncf.osrd.envelope;

import fr.sncf.osrd.utils.SwingUtils;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import org.math.plot.Plot2DPanel;
import javax.swing.*;
import java.util.ArrayList;

@ExcludeFromGeneratedCodeCoverage
public class EnvelopeDebug {
    private static void plotEnvelope(Plot2DPanel plot, Envelope envelope, String envelopeName) {
        for (int i = 0; i < envelope.size(); i++) {
            var lineName = String.format("%s.parts[%d]", envelopeName, i);
            var part = envelope.get(i);
            var positions = part.clonePositions();
            var speeds = part.cloneSpeeds();
            plotArrays(plot, lineName, positions, speeds);
        }
    }

    private static void plotEnvelopeSpaceTime(
            Plot2DPanel plot,
            Envelope envelope,
            String envelopeName,
            double startTime
    ) {
        for (int i = 0; i < envelope.size(); i++) {
            var lineName = String.format("%s.parts[%d]", envelopeName, i);
            var part = envelope.get(i);
            var positions = part.clonePositions();
            var times = new double[part.pointCount()];
            for (int pointIndex = 0; pointIndex < part.pointCount(); pointIndex++)
                times[pointIndex] = startTime + part.getTotalTimeMS(pointIndex) / 1000.;
            plotArrays(plot, lineName, times, positions);
            startTime += part.getTotalTimeMS() / 1000.;
        }
    }

    private static void plotArrays(Plot2DPanel plot, String lineName, double[] xs, double[] ys) {
        // workaround https://github.com/yannrichet/jmathplot/issues/5
        assert xs.length == ys.length;
        if (xs.length == 2) {
            var newXs = new double[] { xs[0], ys[0] };
            var newYs = new double[] { xs[1], ys[1] };
            xs = newXs;
            ys = newYs;
        }
        plot.addLinePlot(lineName, xs, ys);
    }

    /** Creates a plot panel for this envelope */
    public static JPanel plotPanel(Envelope envelope) {
        // create your PlotPanel (you can use it as a JPanel)
        Plot2DPanel plot = new Plot2DPanel();

        // add a line plot to the PlotPanel
        plotEnvelope(plot, envelope, "");

        return plot;
    }

    /** Shows an interactive plot of the envelope */
    public static void plot(Envelope envelope) {
        SwingUtils.debugPanel("Envelope", () -> plotPanel(envelope));
    }

    /** Enables showing multiple envelopes on the same graph:
     * <pre>
     *   EnvelopeDebug.plotBuilder()
     *           .add(doubleCappedEnvelope, "double_capped")
     *           .add(cappedEnvelope, "capped")
     *           .plot();
     * </pre>
     */
    public static PlotBuilder plotBuilder() {
        return new PlotBuilder();
    }

    /** A tool to plot multiple envelopes in the same graph */
    @ExcludeFromGeneratedCodeCoverage
    public static final class PlotBuilder {
        private final ArrayList<Envelope> envelopes = new ArrayList<>();
        private final ArrayList<String> names = new ArrayList<>();
        private final ArrayList<Double> departureTimes = new ArrayList<>();

        /** Add an envelope to the plot */
        public PlotBuilder add(Envelope envelope, String name) {
            return add(envelope, name, 0);
        }

        /** Add an envelope to the plot, specifying start time (only used in space-time charts) */
        public PlotBuilder add(Envelope envelope, String name, double departureTime) {
            envelopes.add(envelope);
            names.add(name);
            departureTimes.add(departureTime);
            return this;
        }

        /** Build and show the plot */
        public void plot() {
            SwingUtils.debugPanel("Envelope", () -> {
                var plot = new Plot2DPanel();
                for (int i = 0; i < envelopes.size(); i++)
                    plotEnvelope(plot, envelopes.get(i), names.get(i));
                return plot;
            });
        }

        /** Build and show the plot, showing time on the horizontal axis and position on the vertical axis */
        public void plotSpaceTime() {
            SwingUtils.debugPanel("Envelope", () -> {
                var plot = new Plot2DPanel();
                for (int i = 0; i < envelopes.size(); i++)
                    plotEnvelopeSpaceTime(plot, envelopes.get(i), names.get(i), departureTimes.get(i));
                return plot;
            });
        }
    }
}
