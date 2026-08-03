package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class MultiTrainSimulationTest {
    private val timeStep = 2.0
    private val pathLength = 10_000.0

    private fun makeContext(length: Double = pathLength) = makeSimpleContext(length, 0.0, timeStep)

    private fun makeSimulator(
        length: Double = pathLength,
        constraints: List<Constraint> = listOf(speedLimit(length)),
    ) = TrainSimulator(makeContext(length), constraints)

    private fun speedLimit(length: Double = pathLength, limit: Double = 20.0) =
        SpeedLimitedZone(0.micrometers, length.meters, limit.metersPerSecond)

    private fun makeTimetable(): List<ScheduledTrain> =
        listOf(
            ScheduledTrain(makeSimulator(), 0.0.seconds),
            ScheduledTrain(
                makeSimulator(constraints = listOf(speedLimit(limit = 12.0))),
                120.0.seconds,
            ),
            ScheduledTrain(
                makeSimulator(constraints = listOf(Stop(5_000.0.meters, 60.0.seconds))),
                300.0.seconds,
            ),
        )

    // TODO: Only valid while trains to interact with each other. The test will have to be removed
    @Test
    fun testEachTrainMatchesItsStandaloneRun() {
        val together = runTrains(makeTimetable(), timeStep.seconds)

        val alone =
            makeTimetable().map {
                it.simulator.runToEnd()
                it.simulator.states
            }

        assertEquals(alone.size, together.size)
        for ((i, expected) in alone.withIndex()) {
            assertEquals(expected, together[i], "train $i doesn't match its standalone run")
        }
    }

    @Test
    fun testEveryTrainReachesItsPathEnd() {
        val states = runTrains(makeTimetable(), timeStep.seconds)

        for ((i, trainStates) in states.withIndex()) {
            assertTrue(trainStates.size > 1, "train $i didn't move")
            assertTrue(
                trainStates.last().position >= pathLength.meters,
                "train $i stopped at ${trainStates.last().position}, short of its path end",
            )
            for ((previous, next) in trainStates.zipWithNext()) {
                assertTrue(previous.time < next.time, "train $i went back in time")
                assertTrue(previous.position <= next.position, "train $i went backwards")
            }
        }
    }

    @Test
    fun testTimetableTrainsBehaveDifferently() {
        val states = runTrains(makeTimetable(), timeStep.seconds)
        val arrivalTimes = states.map { it.last().time }

        assertEquals(
            arrivalTimes.distinct().size,
            arrivalTimes.size,
            "trains are indistinguishable",
        )
    }

    @Test
    fun testDepartureTimeDoesNotChangeTrajectory() {
        val early = makeSimulator()
        val late = makeSimulator()

        runTrains(listOf(ScheduledTrain(early, 0.0.seconds)), timeStep.seconds)
        runTrains(listOf(ScheduledTrain(late, 3600.0.seconds)), timeStep.seconds)

        assertEquals(early.states, late.states)
    }

    @Test
    fun testTrainDepartingLastStillRuns() {
        val first = makeSimulator()
        val last = makeSimulator()

        val states =
            runTrains(
                listOf(ScheduledTrain(first, 0.0.seconds), ScheduledTrain(last, 86400.0.seconds)),
                timeStep.seconds,
            )

        assertTrue(states[1].size > 1)
        assertEquals(states[0], states[1])
    }

    @Test
    fun testTrainOrderDoesNotMatter() {
        val states = runTrains(makeTimetable(), timeStep.seconds)
        val reversedStates = runTrains(makeTimetable().reversed(), timeStep.seconds)

        assertEquals(states, reversedStates.reversed())
    }

    @Test
    fun testPathsOfDifferentLengthsAllTerminate() {
        val shortLength = pathLength / 4.0
        val short = makeSimulator(length = shortLength)
        val long = makeSimulator()

        val states =
            runTrains(
                listOf(ScheduledTrain(short, 0.0.seconds), ScheduledTrain(long, 0.0.seconds)),
                timeStep.seconds,
            )

        assertTrue(states[0].last().position >= shortLength.meters)
        assertTrue(states[0].last().position < pathLength.meters)
        assertTrue(states[1].last().position >= pathLength.meters)
    }

    @Test
    fun testLoopIsDeterministic() {
        val first = runTrains(makeTimetable(), timeStep.seconds)
        val second = runTrains(makeTimetable(), timeStep.seconds)

        assertEquals(first, second)
    }
}
