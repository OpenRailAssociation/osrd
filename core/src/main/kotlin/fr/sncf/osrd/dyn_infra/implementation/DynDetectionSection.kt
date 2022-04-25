package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.dyn_infra.api.DetectionSectionState
import fr.sncf.osrd.dyn_infra.api.DynInfra
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class DynDetectionSection {
    private val _state: MutableStateFlow<DetectionSectionState> = MutableStateFlow(DetectionSectionState.UNRESERVED_FREE)
    private val _mutex = Mutex()
    private var _isReserved = false
    private var _occupationCount = 0

    val state: StateFlow<DetectionSectionState> = _state.asStateFlow()

    private suspend fun sendUpdate() {
        val state = DetectionSectionState.get(_isReserved, _occupationCount > 0)
        _state.emit(state)
    }

    suspend fun occupy(): DynInfra.ResourceHandle {
        _mutex.withLock {
            _occupationCount++
            sendUpdate()
            return OccupationHandle()
        }
    }

    suspend fun reserve(): DynInfra.ResourceHandle {
        _mutex.withLock {
            assert(!_isReserved)
            _isReserved = true
            sendUpdate()
            return ReservationHandle()
        }
    }

    private suspend fun unsafeReleaseOccupation() {
        _mutex.withLock {
            assert(_occupationCount > 0)
            _occupationCount--
            sendUpdate()
        }
    }

    private suspend fun unsafeReleaseReservation() {
        _mutex.withLock {
            assert(_isReserved)
            _isReserved = false
            sendUpdate()
        }
    }

    private inner class OccupationHandle : DynInfra.ResourceHandle {
        var used: Boolean = false

        override suspend fun release() {
            assert(!used)
            used = true
            unsafeReleaseOccupation()
        }
    }

    private inner class ReservationHandle : DynInfra.ResourceHandle {
        var used: Boolean = false

        override suspend fun release() {
            assert(!used)
            used = true
            unsafeReleaseReservation()
        }
    }
}
