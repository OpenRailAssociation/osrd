# Timetable Items Test Dataset

Ensures full functional coverage of timetable import, parsing, and validation.

This dataset is designed to cover a wide range of both **TrainSchedules** and **PacedTrains** in
end-to-end testing.

---

## TrainSchedules

- Multiple rolling stock categories
- Distinct itineraries using predefined trigrams or requested map points
- Different margins and timetable offsets
- Various input configurations
- Diverse speed limit tags and labels
- Includes intentionally invalid trains (missing path, invalid MR, wrong tag)

---

## PacedTrains

- Mirrors TrainSchedule diversity (rolling stock, margins, itineraries, speed limits)
- Includes all possible occurrence types
