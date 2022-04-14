package fr.sncf.osrd.sim

import kotlinx.coroutines.*
import java.util.*
import kotlin.collections.ArrayDeque
import kotlin.coroutines.ContinuationInterceptor
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext

@OptIn(ExperimentalCoroutinesApi::class)
private class TimedRunnable(
    @JvmField val time: Long,
    private val continuation: CancellableContinuation<Unit>
): Comparable<TimedRunnable> {
    fun run(dispatcher: CoroutineDispatcher) {
        with(continuation) { dispatcher.resumeUndispatched(Unit) }
    }

    override fun compareTo(other: TimedRunnable): Int {
        return time.compareTo(other.time)
    }
}

val CoroutineScope.currentTimeMillis: Long get() =
    (coroutineContext[ContinuationInterceptor] as DiscreteEventSimulation).currentTime

@OptIn(InternalCoroutinesApi::class)
private class DiscreteEventSimulation(initialTime: Long): CoroutineDispatcher(), Delay {
    var currentTime: Long = initialTime
        private set

    private val readyTasks = ArrayDeque<Runnable>()
    private val waitingTasks = PriorityQueue<TimedRunnable>()

    override fun dispatch(context: CoroutineContext, block: Runnable) {
        readyTasks.addLast(block)
    }

    override fun scheduleResumeAfterDelay(timeMillis: Long, continuation: CancellableContinuation<Unit>) {
        val eventTime = currentTime + timeMillis
        val waitingTask = TimedRunnable(eventTime, continuation)
        waitingTasks.add(waitingTask)

        // when the continuation is cancelled, remove the timed runnable
        continuation.invokeOnCancellation { waitingTasks.remove(waitingTask) }
    }

    fun step(): Boolean {
        // run a ready task, if any
        if (readyTasks.isNotEmpty()) {
            val task = readyTasks.removeFirst()
            task.run()
            return true
        }

        // otherwise, run a waiting task
        if (waitingTasks.isNotEmpty()) {
            val task = waitingTasks.poll()
            currentTime = task.time
            task.run(this)
            return true
        }

        return false
    }
}

class BlockedSimulationException(message: String) : Exception(message)


@OptIn(ExperimentalCoroutinesApi::class)
fun <T> runSimulation(
    initialTime: Long = 0,
    parentContext: CoroutineContext = EmptyCoroutineContext,
    block: suspend CoroutineScope.() -> T
): T {
    val des = DiscreteEventSimulation(initialTime)
    val scope = CoroutineScope(parentContext + des)
    val deferred = scope.async { block() }

    // loop until there are no more tasks
    while (des.step())
        continue

    if (deferred.isCompleted)
        return deferred.getCompleted()
    throw BlockedSimulationException("the discrete simulation blocked without completing")
}
