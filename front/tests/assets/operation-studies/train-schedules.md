# Train Schedules Test Dataset

Ensures full functional coverage of timetable import, parsing, and validation.

This dataset is designed to cover a wide range of both **Unique Trains** and **PacedTrains** in
end-to-end testing.

---

## Unique Trains

- Multiple rolling stock categories
- Distinct itineraries using predefined main codes or requested map points
- Different margins and timetable offsets
- Various input configurations
- Diverse speed limit tags and labels
- Includes intentionally invalid trains (missing path, invalid MR, wrong tag)

---

## PacedTrains

- Mirrors Unique Trains diversity (rolling stock, margins, itineraries, speed limits)
- Includes all possible occurrence types
