package fr.sncf.osrd.api

import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.utils.Helpers
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi
import org.junit.jupiter.api.Test

@OptIn(ExperimentalSerializationApi::class)
class TimetableCacheManagerTest {

    /**
     * When a fetch fails, the callers waiting on the same timetable must still run one at a time.
     * Before, the per-key mutex was removed from the map on failure while a caller still waited on
     * it, so a later caller made a new mutex and fetched the same timetable in parallel.
     */
    @Test
    fun noParallelFetchAfterFailedFetch() {
        val infra = Helpers.tinyInfra
        val calls = AtomicInteger(0)
        val running = AtomicInteger(0)
        val maxRunning = AtomicInteger(0)
        val firstCallStarted = CountDownLatch(1)
        val failFirstCall = CountDownLatch(1)
        val secondCallStarted = CountDownLatch(1)
        val thirdCallStarted = CountDownLatch(1)
        val releaseCalls = CountDownLatch(1)

        val provider =
            object : TimetableProvider {
                override fun getTimetableData(
                    infraId: String,
                    infra: RawInfra,
                    timetableId: TimetableId,
                ): STDCMTimetableData {
                    maxRunning.accumulateAndGet(running.incrementAndGet(), ::maxOf)
                    try {
                        when (calls.incrementAndGet()) {
                            1 -> {
                                firstCallStarted.countDown()
                                failFirstCall.await(10, TimeUnit.SECONDS)
                                throw RuntimeException("fetch failed")
                            }
                            2 -> secondCallStarted.countDown()
                            else -> thirdCallStarted.countDown()
                        }
                        releaseCalls.await(10, TimeUnit.SECONDS)
                        return STDCMTimetableData(mapOf(), mapOf())
                    } finally {
                        running.decrementAndGet()
                    }
                }
            }
        val cacheManager = TimetableCacheManager(provider, osrdGitDescribe = "test")

        runBlocking(Dispatchers.Default) {
            val first = async { runCatching { cacheManager.get(infra, 1) } }
            assertTrue(firstCallStarted.await(10, TimeUnit.SECONDS))
            // This caller waits on the lock held by the first one
            val second = async { cacheManager.get(infra, 1) }
            Thread.sleep(200)
            failFirstCall.countDown()
            assertTrue(first.await().isFailure)
            assertTrue(secondCallStarted.await(10, TimeUnit.SECONDS))

            // A new caller comes while the second fetch is running: it must wait for it
            val third = async { cacheManager.get(infra, 1) }
            thirdCallStarted.await(500, TimeUnit.MILLISECONDS)
            releaseCalls.countDown()
            second.await()
            third.await()
        }
        assertEquals(1, maxRunning.get())
        assertEquals(2, calls.get())
    }
}
