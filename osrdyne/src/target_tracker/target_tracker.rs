use log::{error, debug};
use priority_queue::PriorityQueue;
use thunderdome::{Arena, Index};
use tokio::time::{Duration, Instant};
use std::{collections::HashMap, cmp::Reverse};

use crate::Key;


#[derive(Clone, Copy, Debug, PartialOrd, PartialEq, Ord, Eq)]
pub enum QueueStatus {
    Active,
    Unbound,
}

impl QueueStatus {
    fn next(&self) -> Option<QueueStatus> {
        match self {
            QueueStatus::Active => Some(QueueStatus::Unbound),
            QueueStatus::Unbound => None,
        }
    }
}

pub type QueueStateMap = im::OrdMap<Key, QueueStatus>;

struct Queue {
    key: Key,
    // The reference time used for the spooldown schedule.
    // This is set to the last require time + extra lifetime
    schedule_start: Instant,
}


#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct GenerationId(u64);

impl GenerationId {
    fn new() -> Self {
        GenerationId(0)
    }

    fn bump(&mut self) {
        self.0 += 1;
    }
}


pub struct TargetTracker {
    /// The delay from last active time until unbinding
    unbind_delay: Duration,
    /// Delay from unbinding to deletion
    delete_delay: Duration,

    // a full description of all queues
    queues: Arena<Queue>,

    // an index by worker group name
    queues_by_key: HashMap<Key, Index>,

    // a queue of next planned transitions
    planned_transitions: PriorityQueue<Index, Reverse<Instant>>,

    // The target pool state. When it changes, the generation counts up.
    state: QueueStateMap,

    // Counts the number of times the state changed
    generation: GenerationId,
}


impl TargetTracker {
    pub fn get_target_state(&self) -> QueueStateMap {
        self.state.clone()
    }

    pub fn get_generation(&self) -> GenerationId {
        self.generation
    }

    pub fn new(initial_time: Instant, initial_worker_ids: Vec<Key>, unbind_delay: Duration, delete_delay: Duration) -> Self {
        let mut state = TargetTracker {
            unbind_delay,
            delete_delay,
            queues: Arena::new(),
            queues_by_key: HashMap::new(),
            planned_transitions: PriorityQueue::new(),
            state: QueueStateMap::new(),
            generation: GenerationId::new(),
        };

        for initial_worker_id in initial_worker_ids {
            state.require_queue(initial_time, Duration::ZERO, &initial_worker_id);
        }

        // Reset the state generation to 0 to make things easier to follow
        state.generation = GenerationId::new();

        state
    }

    pub fn deadline(&self) -> Option<Instant> {
        self.planned_transitions.peek().map(|(_queue, at)| at.0)
    }

    fn expected_status(&self, last_used_at: Instant, now: Instant) -> Option<QueueStatus> {
        let mut status = QueueStatus::Active;
        loop {
            let new_status = status.next();
            let transition_time = self.event_time(last_used_at, new_status);
            if now < transition_time {
                return Some(status);
            }
            status = match new_status {
                Some(status) => status,
                None => return None,
            };
        }
    }

    fn event_time(&self, last_used_at: Instant, status: Option<QueueStatus>) -> Instant {
        match status {
            Some(QueueStatus::Active) => last_used_at,
            Some(QueueStatus::Unbound) => last_used_at + self.unbind_delay,
            None => last_used_at + self.unbind_delay + self.delete_delay,
        }
    }

    fn queue_update_transition(&mut self, queue_idx: Index) {
        let queue = &self.queues[queue_idx];
        let current_status = self.state[&queue.key];
        let next_status = current_status.next();
        let transition_time = self.event_time(queue.schedule_start, next_status);
        self.planned_transitions.push(queue_idx, Reverse(transition_time));
    }

    fn queue_apply_transition(&mut self, at: Instant, queue_idx: Index) {
        let queue = &self.queues[queue_idx];
        let current = self.state[&queue.key];
        let expected = self.expected_status(queue.schedule_start, at);

        if Some(current) == expected {
            error!("inconsistent state: no transition required for {:?} in state {:?}", &queue.key, current);
            return;
        }

        debug!("transition of {:?} from {:?} to {:?} at age {:?}", &queue.key, &current, &expected, at - queue.schedule_start);

        // if the worker group still exists, update its status
        if let Some(new_status) = expected {
            self.state[&queue.key] = new_status;
            self.generation.bump();
            self.queue_update_transition(queue_idx);
            return;
        }

        // otherwise, remove the worker group
        self.planned_transitions.remove(&queue_idx);
        self.queues_by_key.remove(&queue.key);
        self.state.remove(&queue.key);
        self.generation.bump();
        self.queues.remove(queue_idx);
    }

    pub fn require_queue(&mut self, at: Instant, extra_lifetime: Duration, key: &Key) {
        let queue_idx = if let Some(queue_idx) = self.queues_by_key.get(key) {
            // update the worker group creation time
            let queue = &mut self.queues[*queue_idx];
            queue.schedule_start = at;
            if self.state[&queue.key] != QueueStatus::Active {
                self.state[&queue.key] = QueueStatus::Active;
                self.generation.bump();
            }
            *queue_idx
        } else {
            // create the worker group
            let queue_idx = self.queues.insert(Queue {
                key: key.clone(),
                schedule_start: at + extra_lifetime,
            });
            self.queues_by_key.insert(key.clone(), queue_idx);
            self.state.insert(key.clone(), QueueStatus::Active);
            self.generation.bump();
            queue_idx
        };
        self.queue_update_transition(queue_idx);
    }

    /// Evolve the current state of worker groups until
    pub fn evolve_until(&mut self, now: Instant) {
        while let Some((queue_idx, transition_at)) = self.planned_transitions.peek() {
            if transition_at.0 > now {
                break
            }
            self.queue_apply_transition(now, *queue_idx);
        }
    }
}
